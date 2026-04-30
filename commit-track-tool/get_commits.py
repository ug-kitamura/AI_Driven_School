#!/usr/bin/env python3
"""
get_commits.py - GitHubリポジトリの週次コミットデータを取得するスクリプト

使い方:
	python get_commits.py \
		--owner your-username \
		--repo your-repo \
		--output

オプション:
	--owner         GitHubオーナー名（必須）
	--repo          リポジトリ名（必須）
	--days          直近何日分を取得するか（デフォルト: 7）
	--output, -o    指定すると output/commits.json に保存（省略時はstdout）
	--active-days   アクティブブランチの判定日数（デフォルト: 30）
	--concurrency   並列リクエスト数（デフォルト: 5）
	--token         GitHub APIトークン（省略時は環境変数 GH_TOKEN を使用）
	--no-gitignore  .gitignoreによるファイルフィルタを無効化

環境変数:
	GH_TOKEN        GitHub APIトークン（--token 未指定時のフォールバック）
"""

import argparse
import base64
import hashlib
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

try:
	from dotenv import load_dotenv
	load_dotenv()
except ImportError:
	pass  # python-dotenv 未インストール時は環境変数または --token 引数を使用

try:
	import pathspec
	HAS_PATHSPEC = True
except ImportError:
	HAS_PATHSPEC = False

# JSTタイムゾーン
JST = timezone(timedelta(hours=9))

# 取得対象から除外するブランチのプレフィックス
EXCLUDED_BRANCH_PREFIXES = ["dependabot/", "renovate/"]

GRAPHQL_BRANCHES_QUERY = """
query($owner: String!, $repo: String!, $cursor: String) {
	repository(owner: $owner, name: $repo) {
		defaultBranchRef { name }
		refs(refPrefix: "refs/heads/", first: 100, after: $cursor) {
			nodes {
				name
				target {
					... on Commit { committedDate }
				}
			}
			pageInfo { hasNextPage endCursor }
		}
	}
}
"""


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="GitHubリポジトリの週次コミットデータを取得する",
		formatter_class=argparse.RawDescriptionHelpFormatter,
	)
	parser.add_argument("--owner", required=True, help="GitHubオーナー名")
	parser.add_argument("--repo", required=True, help="リポジトリ名")
	parser.add_argument(
		"--days",
		type=int,
		default=7,
		help="直近何日分のコミットを取得するか（デフォルト: 7）",
	)
	parser.add_argument(
		"--output", "-o",
		action="store_true",
		default=False,
		help="指定すると output/commits.json に保存（省略時はstdout）",
	)
	parser.add_argument(
		"--active-days",
		type=int,
		default=30,
		help="アクティブブランチの判定日数（デフォルト: 30）",
	)
	parser.add_argument(
		"--concurrency",
		type=int,
		default=5,
		help="ファイル取得の並列リクエスト数（デフォルト: 5）",
	)
	parser.add_argument(
		"--token",
		default=None,
		help="GitHub APIトークン（省略時は環境変数 GH_TOKEN を使用）",
	)
	parser.add_argument(
		"--no-gitignore",
		action="store_true",
		help=".gitignoreによるファイルフィルタを無効化する",
	)
	return parser.parse_args()


def parse_date_range(days: int) -> tuple[datetime, datetime, str]:
	"""現在時刻から days 日前 〜 現在時刻の UTC datetime を返す。"""
	now_jst = datetime.now(JST)
	end_utc = now_jst.astimezone(timezone.utc)
	start_utc = end_utc - timedelta(days=days)
	label = (
		f"直近{days}日間"
		f" ({start_utc.strftime('%Y-%m-%d')} ～ {end_utc.strftime('%Y-%m-%d')} UTC)"
	)
	return start_utc, end_utc, label


def make_headers(token: str) -> dict:
	return {
		"Authorization": f"Bearer {token}",
		"Accept": "application/vnd.github.v3+json",
		"X-GitHub-Api-Version": "2022-11-28",
	}


def fetch_gitignore_spec(owner: str, repo: str, headers: dict):
	"""
	対象リポジトリの .gitignore を GitHub API で取得し、pathspec オブジェクトを返す。
	取得できない場合は None を返す。
	"""
	if not HAS_PATHSPEC:
		print(
			"[警告] pathspec ライブラリが未インストールのため .gitignore フィルタを無効化します。"
			" `pip install pathspec` でインストールしてください。",
			file=sys.stderr,
		)
		return None

	url = f"https://api.github.com/repos/{owner}/{repo}/contents/.gitignore"
	resp = requests.get(url, headers=headers, timeout=10)

	if resp.status_code == 404:
		print("[.gitignore] リポジトリに .gitignore が見つかりませんでした（フィルタなし）", file=sys.stderr)
		return None

	resp.raise_for_status()
	content = base64.b64decode(resp.json()["content"]).decode("utf-8")
	lines = [l for l in content.splitlines() if l.strip() and not l.startswith("#")]
	spec = pathspec.PathSpec.from_lines("gitwildmatch", lines)
	print(f"[.gitignore] {len(lines)} パターンを読み込みました", file=sys.stderr)
	return spec


def get_all_branches(owner: str, repo: str, headers: dict) -> tuple[list[dict], str]:
	"""GraphQL で全ブランチ一覧と最終コミット日を取得する（ページネーション対応）。"""
	graphql_headers = {**headers, "Content-Type": "application/json"}
	all_branches: list[dict] = []
	cursor = None
	default_branch = "main"

	while True:
		payload = {
			"query": GRAPHQL_BRANCHES_QUERY,
			"variables": {"owner": owner, "repo": repo, "cursor": cursor},
		}
		resp = requests.post(
			"https://api.github.com/graphql",
			headers=graphql_headers,
			json=payload,
			timeout=30,
		)
		resp.raise_for_status()
		data = resp.json()

		if "errors" in data:
			print(f"[GraphQLエラー] {data['errors']}", file=sys.stderr)
			sys.exit(1)

		repo_data = data["data"]["repository"]
		if repo_data["defaultBranchRef"]:
			default_branch = repo_data["defaultBranchRef"]["name"]

		for node in repo_data["refs"]["nodes"]:
			name = node["name"]
			if any(name.startswith(p) for p in EXCLUDED_BRANCH_PREFIXES):
				continue
			all_branches.append({
				"name": name,
				"last_commit_date": (
					node["target"].get("committedDate") if node["target"] else None
				),
				"is_default": name == default_branch,
			})

		page_info = repo_data["refs"]["pageInfo"]
		if not page_info["hasNextPage"]:
			break
		cursor = page_info["endCursor"]

	return all_branches, default_branch


def filter_active_branches(
	branches: list[dict], active_days: int, end_utc: datetime
) -> list[dict]:
	"""アクティブ日数の条件を満たすブランチのみ返す。デフォルトブランチは常に含める。"""
	cutoff = end_utc - timedelta(days=active_days)
	result = []
	for b in branches:
		if b["is_default"]:
			result.append(b)
			continue
		if b["last_commit_date"]:
			last = datetime.fromisoformat(b["last_commit_date"].replace("Z", "+00:00"))
			if last >= cutoff:
				result.append(b)
	return result


def normalize_author(raw_commit: dict) -> dict:
	"""コミットデータから author 情報を正規化する（GitHubアカウント未連携時はGravatar使用）。"""
	if raw_commit.get("author") and raw_commit["author"].get("login"):
		return {
			"login": raw_commit["author"]["login"],
			"avatar_url": raw_commit["author"]["avatar_url"],
		}
	email = raw_commit.get("commit", {}).get("author", {}).get("email", "")
	name = raw_commit.get("commit", {}).get("author", {}).get("name", "Unknown")
	md5_hash = (
		hashlib.md5(email.lower().strip().encode()).hexdigest()
		if email
		else "0" * 32
	)
	return {
		"login": name,
		"avatar_url": f"https://www.gravatar.com/avatar/{md5_hash}?d=identicon&s=80",
	}


def get_branch_commits(
	owner: str,
	repo: str,
	branch: str,
	since: datetime,
	until: datetime,
	headers: dict,
	max_retries: int = 3,
) -> list[dict]:
	"""指定ブランチの期間内コミットを取得する（ページネーション・指数バックオフ付き）。"""
	url = f"https://api.github.com/repos/{owner}/{repo}/commits"
	params = {
		"sha": branch,
		"since": since.isoformat(),
		"until": until.isoformat(),
		"per_page": 100,
	}
	commits: list[dict] = []
	page = 1

	while True:
		params["page"] = page
		resp = None

		for attempt in range(1, max_retries + 1):
			try:
				resp = requests.get(url, headers=headers, params=params, timeout=30)
				resp.raise_for_status()
				break
			except requests.RequestException as e:
				if attempt == max_retries:
					print(f"  [{branch}] ⚠️ 取得失敗（{max_retries}回試行）: {e}", file=sys.stderr)
					return commits
				wait = 2 ** (attempt - 1)
				print(f"  [{branch}] リトライ {attempt}/{max_retries} ({wait}s後): {e}", file=sys.stderr)
				time.sleep(wait)

		if resp is None:
			break

		batch = resp.json()
		if not batch:
			break

		for raw in batch:
			commits.append({
				"sha": raw["sha"],
				"message": raw["commit"]["message"],
				"date": raw["commit"]["author"]["date"],
				"author": normalize_author(raw),
				"url": raw["html_url"],
				"branch": branch,
				"files": [],  # {"path": str, "status": str} のリスト。Step 3 で取得
			})

		if len(batch) < 100:
			break
		page += 1

	return commits


def get_commit_files(
	owner: str, repo: str, sha: str, headers: dict
) -> list[dict]:
	"""
	コミットの変更ファイル一覧を取得する。
	各ファイルは {"path": str, "status": str} の形式。
	status は "added" / "removed" / "modified" / "renamed" / "copied" のいずれか。
	"""
	url = f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}"
	try:
		resp = requests.get(url, headers=headers, timeout=15)
		resp.raise_for_status()
		return [
			{"path": f["filename"], "status": f["status"]}
			for f in resp.json().get("files", [])
		]
	except requests.RequestException as e:
		print(f"  [{sha[:7]}] ファイル取得エラー: {e}", file=sys.stderr)
		return []


def main() -> None:
	args = parse_args()

	token = args.token or os.environ.get("GH_TOKEN")
	if not token:
		print("エラー: --token または环境変数 GH_TOKEN でトークンを指定してください", file=sys.stderr)
		sys.exit(1)

	headers = make_headers(token)
	start_utc, end_utc, period_label = parse_date_range(args.days)

	print("=== コミット取得開始 ===", file=sys.stderr)
	print(f"対象期間   : {period_label}", file=sys.stderr)
	print(f"期間(UTC)  : {start_utc.strftime('%Y-%m-%d %H:%M:%S')} ～ {end_utc.strftime('%Y-%m-%d %H:%M:%S')}", file=sys.stderr)
	print(f"リポジトリ : {args.owner}/{args.repo}", file=sys.stderr)
	print(f"アクティブ判定: 過去 {args.active_days} 日以内", file=sys.stderr)
	print("=" * 22, file=sys.stderr)

	# .gitignore フィルタの準備
	spec = None
	if not args.no_gitignore:
		spec = fetch_gitignore_spec(args.owner, args.repo, headers)

	# Step 1: ブランチ一覧取得
	print("\n[Step 1] ブランチ一覧を取得中...", file=sys.stderr)
	all_branches, default_branch = get_all_branches(args.owner, args.repo, headers)
	active_branches = filter_active_branches(all_branches, args.active_days, end_utc)
	print(f"  総ブランチ数     : {len(all_branches)}", file=sys.stderr)
	print(f"  アクティブブランチ: {len(active_branches)}", file=sys.stderr)
	for b in active_branches:
		marker = " (default)" if b["is_default"] else ""
		print(f"    - {b['name']}{marker}", file=sys.stderr)

	# Step 2: コミット取得（重複排除）
	print(f"\n[Step 2] 各ブランチのコミットを取得中...", file=sys.stderr)
	all_commits: list[dict] = []
	seen_shas: set[str] = set()

	for i, branch in enumerate(active_branches, 1):
		print(f"  [{i}/{len(active_branches)}] {branch['name']} ...", file=sys.stderr)
		commits = get_branch_commits(
			args.owner, args.repo, branch["name"], start_utc, end_utc, headers
		)
		added = 0
		for c in commits:
			if c["sha"] not in seen_shas:
				seen_shas.add(c["sha"])
				all_commits.append(c)
				added += 1
		if added:
			print(f"    → {added} 件", file=sys.stderr)

	print(f"\n  総コミット数（重複排除）: {len(all_commits)}", file=sys.stderr)

	if not all_commits:
		print("\n[情報] 対象期間内にコミットが見つかりませんでした", file=sys.stderr)

	# Step 3: 変更ファイル名を並列取得 → .gitignore フィルタ適用
	if all_commits:
		print(f"\n[Step 3] 変更ファイルを取得中（並列数: {args.concurrency}）...", file=sys.stderr)

		def fetch_and_filter_files(commit: dict) -> None:
			files = get_commit_files(args.owner, args.repo, commit["sha"], headers)
			if spec:
				files = [f for f in files if not spec.match_file(f["path"])]
			commit["files"] = files

		completed = 0
		with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
			futures = {
				executor.submit(fetch_and_filter_files, c): c["sha"]
				for c in all_commits
			}
			for future in as_completed(futures):
				future.result()
				completed += 1
				if completed % 10 == 0 or completed == len(all_commits):
					print(f"  進捗: {completed} / {len(all_commits)}", file=sys.stderr)

	# 出力
	output = {
		"metadata": {
			"period": period_label,
			"days": args.days,
			"start_utc": start_utc.isoformat(),
			"end_utc": end_utc.isoformat(),
			"repository": f"{args.owner}/{args.repo}",
			"default_branch": default_branch,
			"total_branches": len(all_branches),
			"active_branches_checked": len(active_branches),
			"total_commits": len(all_commits),
			"gitignore_filter_applied": spec is not None,
		},
		"commits": all_commits,
	}

	json_str = json.dumps(output, ensure_ascii=False, indent=2)

	if args.output:
		output_path = Path("output") / "commits.json"
		output_path.parent.mkdir(exist_ok=True)
		output_path.write_text(json_str, encoding="utf-8")
		print(f"\n✅ 出力完了: {output_path}", file=sys.stderr)
	else:
		print(json_str)

	print("\n=== 完了 ===", file=sys.stderr)
	print(f"対象期間  : {period_label}", file=sys.stderr)
	print(f"コミット数: {len(all_commits)}", file=sys.stderr)


if __name__ == "__main__":
	main()

