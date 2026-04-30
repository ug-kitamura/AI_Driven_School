#!/usr/bin/env python3
"""
get_report_data.py - 週次レポート用のPR・Issue・Milestone・貢献度データを取得するスクリプト

使い方:
	python get_report_data.py \
		--owner your-username \
		--repo your-repo \
		--output

オプション:
	--owner       GitHubオーナー名（必須）
	--repo        リポジトリ名（必須）
	--days        直近何日分を対象とするか（デフォルト: 7）
	--token       GitHub APIトークン（省略時は環境変数 GH_TOKEN を使用）
	--output, -o  指定すると output/report_data.json に保存（省略時はstdout）

環境変数:
	GH_TOKEN      GitHub APIトークン（--token 未指定時のフォールバック）

出力:
	{
		"metadata": { ... },
		"prs": {
			"merged": [...],          # 期間内にマージされたPR
			"open": [...],            # 現在オープンなPR（review_status付き）
			"summary": {
				"merged_count": N,
				"open_count": N,
				"awaiting_review_count": N,      # レビュー未着手
				"feedback_in_progress_count": N, # Changes Requested（フィードバック対応中）
				"approved_count": N              # 承認済み・マージ待ち
			}
		},
		"issues": {
			"closed_count": N,
			"closed": [...]
		},
		"milestones": [...],          # 参考用
		"contributor_activity": {     # PR・レビュー単位の貢献数
			"yamada": {
				"prs_created": N,
				"prs_merged": N,
				"reviews_submitted": N
			}
		}
	}
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import requests

try:
	from dotenv import load_dotenv
	load_dotenv()
except ImportError:
	pass  # python-dotenv 未インストール時は環境変数または --token 引数を使用

JST = timezone(timedelta(hours=9))

# PR の review_status 値
REVIEW_STATUS_AWAITING = "awaiting_review"
REVIEW_STATUS_FEEDBACK = "feedback_in_progress"  # 旧称: ブロッカー。Changes Requested 状態
REVIEW_STATUS_APPROVED = "approved"
REVIEW_STATUS_DRAFT = "draft"

# GraphQL: オープンPRをレビュー状態つきで一括取得
GRAPHQL_OPEN_PRS_QUERY = """
query($owner: String!, $repo: String!, $cursor: String) {
	repository(owner: $owner, name: $repo) {
		pullRequests(states: OPEN, first: 50, after: $cursor, orderBy: {field: UPDATED_AT, direction: DESC}) {
			nodes {
				number
				title
				isDraft
				url
				createdAt
				updatedAt
				author { login avatarUrl }
				headRefName
				reviewRequests(first: 10) {
					totalCount
					nodes {
						requestedReviewer {
							... on User { login }
						}
					}
				}
				reviews(states: [CHANGES_REQUESTED], last: 1) {
					totalCount
				}
        latestOpinionatedReviews {
					nodes {
						state
						author { login }
					}
				}
			}
			pageInfo { hasNextPage endCursor }
		}
	}
}
"""


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="週次レポート用のPR・Issue・Milestone・貢献度データを取得する",
		formatter_class=argparse.RawDescriptionHelpFormatter,
	)
	parser.add_argument("--owner", required=True, help="GitHubオーナー名")
	parser.add_argument("--repo", required=True, help="リポジトリ名")
	parser.add_argument(
		"--days",
		type=int,
		default=7,
		help="直近何日分を対象とするか（デフォルト: 7）",
	)
	parser.add_argument(
		"--token",
		default=None,
		help="GitHub APIトークン（省略時は環境変数 GH_TOKEN を使用）",
	)
	parser.add_argument(
		"--output", "-o",
		action="store_true",
		default=False,
		help="指定すると output/report_data.json に保存（省略時はstdout）",
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


def paginate_rest(url: str, headers: dict, params: dict | None = None) -> list[dict]:
	"""GitHub REST API のページネーションを処理して全件返す。"""
	results = []
	page = 1
	base_params = dict(params or {})
	base_params["per_page"] = 100

	while True:
		base_params["page"] = page
		resp = requests.get(url, headers=headers, params=base_params, timeout=30)
		resp.raise_for_status()
		batch = resp.json()
		if not batch:
			break
		results.extend(batch)
		if len(batch) < 100:
			break
		page += 1

	return results


def fetch_merged_prs(
	owner: str, repo: str, headers: dict, since: datetime, until: datetime
) -> tuple[list[dict], dict]:
	"""
	期間内にマージされたPRを取得する。
	contributor_activity（prs_created, prs_merged）も集計して返す。
	"""
	url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
	raw_prs = paginate_rest(url, headers, {"state": "closed", "sort": "updated", "direction": "desc"})

	merged = []
	activity: dict[str, dict] = {}

	for pr in raw_prs:
		merged_at_str = pr.get("merged_at")
		if not merged_at_str:
			continue

		merged_at = datetime.fromisoformat(merged_at_str.replace("Z", "+00:00"))

		# 期間外は古い順にスキップ（updated_at降順なので古いものは後半）
		if merged_at < since:
			continue
		if merged_at > until:
			continue

		author_login = pr["user"]["login"] if pr.get("user") else "unknown"
		author_avatar = pr["user"]["avatar_url"] if pr.get("user") else ""

		merged.append({
			"number": pr["number"],
			"title": pr["title"],
			"author": {"login": author_login, "avatar_url": author_avatar},
			"merged_at": merged_at_str,
			"branch": pr["head"]["ref"],
			"url": pr["html_url"],
		})

		# 貢献度: prs_created & prs_merged
		_ensure_contributor(activity, author_login, author_avatar)
		activity[author_login]["prs_created"] += 1
		activity[author_login]["prs_merged"] += 1

	return merged, activity


def classify_open_pr(node: dict) -> str:
	"""
	GraphQL レスポンスのPRノードからレビューステータスを分類する。

	- draft: まだレビュー受け付けていない
	- feedback_in_progress: いずれかのレビュアーが Changes Requested
	- approved: 全レビュアーが Approved（または Approved のみ存在）
	- awaiting_review: レビュー未着手 or コメントのみ
	"""
	if node.get("isDraft"):
		return REVIEW_STATUS_DRAFT

	latest_reviews = node.get("latestOpinionatedReviews", {}).get("nodes", [])
	states = {r["state"] for r in latest_reviews}

	if "CHANGES_REQUESTED" in states:
		return REVIEW_STATUS_FEEDBACK
	if states and all(s == "APPROVED" for s in states):
		return REVIEW_STATUS_APPROVED
	return REVIEW_STATUS_AWAITING


def fetch_open_prs_graphql(
	owner: str, repo: str, headers: dict
) -> tuple[list[dict], dict]:
	"""
	GraphQL でオープンPRをレビューステータス付きで取得する。
	contributor_activity（prs_created）も集計して返す。
	"""
	graphql_headers = {**headers, "Content-Type": "application/json"}
	open_prs: list[dict] = []
	activity: dict[str, dict] = {}
	cursor = None

	while True:
		payload = {
			"query": GRAPHQL_OPEN_PRS_QUERY,
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

		pr_nodes = data["data"]["repository"]["pullRequests"]

		for node in pr_nodes["nodes"]:
			author_login = node["author"]["login"] if node.get("author") else "unknown"
			author_avatar = node["author"]["avatarUrl"] if node.get("author") else ""
			review_status = classify_open_pr(node)

			reviewers = [
				r["requestedReviewer"]["login"]
				for r in node["reviewRequests"]["nodes"]
				if r.get("requestedReviewer") and r["requestedReviewer"].get("login")
			]

			open_prs.append({
				"number": node["number"],
				"title": node["title"],
				"author": {"login": author_login, "avatar_url": author_avatar},
				"created_at": node["createdAt"],
				"updated_at": node["updatedAt"],
				"url": node["url"],
				"branch": node["headRefName"],
				"draft": node["isDraft"],
				"review_status": review_status,
				"requested_reviewers": reviewers,
			})

			_ensure_contributor(activity, author_login, author_avatar)
			activity[author_login]["prs_created"] += 1

		if not pr_nodes["pageInfo"]["hasNextPage"]:
			break
		cursor = pr_nodes["pageInfo"]["endCursor"]

	return open_prs, activity


def fetch_reviews(
	owner: str, repo: str, headers: dict, pr_numbers: list[int], since: datetime, until: datetime
) -> dict:
	"""
	対象PRのレビューを取得し、期間内のレビュー数を人ごとに集計する。
	"""
	activity: dict[str, dict] = {}

	for i, pr_number in enumerate(pr_numbers, 1):
		if i % 10 == 0:
			print(f"  レビュー取得: {i}/{len(pr_numbers)}", file=sys.stderr)

		url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/reviews"
		try:
			resp = requests.get(url, headers=headers, timeout=15)
			resp.raise_for_status()
			reviews = resp.json()
		except requests.RequestException as e:
			print(f"  [PR#{pr_number}] レビュー取得エラー: {e}", file=sys.stderr)
			continue

		for review in reviews:
			submitted_at_str = review.get("submitted_at")
			if not submitted_at_str:
				continue

			submitted_at = datetime.fromisoformat(submitted_at_str.replace("Z", "+00:00"))
			if not (since <= submitted_at <= until):
				continue

			# コメントのみ（COMMENTED）・承認（APPROVED）・変更要求（CHANGES_REQUESTED）を全てカウント
			reviewer = review["user"]["login"] if review.get("user") else "unknown"
			avatar = review["user"]["avatar_url"] if review.get("user") else ""
			_ensure_contributor(activity, reviewer, avatar)
			activity[reviewer]["reviews_submitted"] += 1

		time.sleep(0.05)  # レートリミット対策

	return activity


def fetch_closed_issues(
	owner: str, repo: str, headers: dict, since: datetime, until: datetime
) -> tuple[int, list[dict]]:
	"""期間内にクローズされたIssueを取得する（PRを除く）。"""
	url = f"https://api.github.com/repos/{owner}/{repo}/issues"
	raw = paginate_rest(
		url, headers,
		{"state": "closed", "sort": "updated", "direction": "desc", "since": since.isoformat()}
	)

	closed = []
	for issue in raw:
		# PRはissues APIにも混入するので除外
		if issue.get("pull_request"):
			continue

		closed_at_str = issue.get("closed_at")
		if not closed_at_str:
			continue

		closed_at = datetime.fromisoformat(closed_at_str.replace("Z", "+00:00"))
		if not (since <= closed_at <= until):
			continue

		closed.append({
			"number": issue["number"],
			"title": issue["title"],
			"closed_at": closed_at_str,
			"url": issue["html_url"],
		})

	return len(closed), closed


def fetch_milestones(owner: str, repo: str, headers: dict) -> list[dict]:
	"""アクティブなマイルストーンを取得する（参考用）。"""
	url = f"https://api.github.com/repos/{owner}/{repo}/milestones"
	raw = paginate_rest(url, headers, {"state": "open", "sort": "due_on"})

	milestones = []
	for ms in raw:
		total = ms["open_issues"] + ms["closed_issues"]
		progress_pct = round(ms["closed_issues"] / total * 100) if total > 0 else 0
		milestones.append({
			"title": ms["title"],
			"due_on": ms.get("due_on"),
			"open_issues": ms["open_issues"],
			"closed_issues": ms["closed_issues"],
			"total_issues": total,
			"progress_pct": progress_pct,
			"url": ms["html_url"],
		})

	return milestones


def merge_contributor_activity(*activity_dicts: dict) -> dict:
	"""複数の contributor_activity を統合する。"""
	merged: dict[str, dict] = {}
	for activity in activity_dicts:
		for login, data in activity.items():
			if login not in merged:
				merged[login] = {
					"login": login,
					"avatar_url": data.get("avatar_url", ""),
					"prs_created": 0,
					"prs_merged": 0,
					"reviews_submitted": 0,
				}
			merged[login]["prs_created"] += data.get("prs_created", 0)
			merged[login]["prs_merged"] += data.get("prs_merged", 0)
			merged[login]["reviews_submitted"] += data.get("reviews_submitted", 0)
	return merged


def _ensure_contributor(activity: dict, login: str, avatar_url: str) -> None:
	"""activity dict に login が存在しなければ初期化する。"""
	if login not in activity:
		activity[login] = {
			"login": login,
			"avatar_url": avatar_url,
			"prs_created": 0,
			"prs_merged": 0,
			"reviews_submitted": 0,
		}


def main() -> None:
	args = parse_args()

	token = args.token or os.environ.get("GH_TOKEN")
	if not token:
		print("エラー: --token または環境変数 GH_TOKEN でトークンを指定してください", file=sys.stderr)
		sys.exit(1)

	headers = make_headers(token)
	start_utc, end_utc, period_label = parse_date_range(args.days)

	print("=== レポートデータ取得開始 ===", file=sys.stderr)
	print(f"対象期間   : {period_label}", file=sys.stderr)
	print(f"リポジトリ : {args.owner}/{args.repo}", file=sys.stderr)
	print("=" * 28, file=sys.stderr)

	# マージ済みPR
	print("\n[Step 1] マージ済みPRを取得中...", file=sys.stderr)
	merged_prs, merged_activity = fetch_merged_prs(
		args.owner, args.repo, headers, start_utc, end_utc
	)
	print(f"  マージ済みPR: {len(merged_prs)} 件", file=sys.stderr)

	# オープンPR（レビュー状態付き）
	print("\n[Step 2] オープンPRをレビュー状態付きで取得中...", file=sys.stderr)
	open_prs, open_activity = fetch_open_prs_graphql(args.owner, args.repo, headers)

	awaiting = sum(1 for p in open_prs if p["review_status"] == REVIEW_STATUS_AWAITING)
	feedback = sum(1 for p in open_prs if p["review_status"] == REVIEW_STATUS_FEEDBACK)
	approved = sum(1 for p in open_prs if p["review_status"] == REVIEW_STATUS_APPROVED)
	draft = sum(1 for p in open_prs if p["review_status"] == REVIEW_STATUS_DRAFT)

	print(f"  オープンPR: {len(open_prs)} 件", file=sys.stderr)
	print(f"    レビュー待ち       : {awaiting} 件", file=sys.stderr)
	print(f"    フィードバック対応中: {feedback} 件", file=sys.stderr)
	print(f"    承認済み           : {approved} 件", file=sys.stderr)
	print(f"    ドラフト           : {draft} 件", file=sys.stderr)

	# 期間内レビュー数を人ごとに集計（マージ済み + オープン両方のPRが対象）
	print("\n[Step 3] レビュー実績を集計中...", file=sys.stderr)
	all_pr_numbers = [p["number"] for p in merged_prs] + [p["number"] for p in open_prs]
	review_activity = fetch_reviews(
		args.owner, args.repo, headers, all_pr_numbers, start_utc, end_utc
	)
	total_reviews = sum(a["reviews_submitted"] for a in review_activity.values())
	print(f"  期間内レビュー数: {total_reviews} 件", file=sys.stderr)

	# クローズしたIssue
	print("\n[Step 4] クローズしたIssueを取得中...", file=sys.stderr)
	closed_issue_count, closed_issues = fetch_closed_issues(
		args.owner, args.repo, headers, start_utc, end_utc
	)
	print(f"  クローズしたIssue: {closed_issue_count} 件", file=sys.stderr)

	# マイルストーン（参考用）
	print("\n[Step 5] マイルストーンを取得中（参考用）...", file=sys.stderr)
	milestones = fetch_milestones(args.owner, args.repo, headers)
	print(f"  アクティブなマイルストーン: {len(milestones)} 件", file=sys.stderr)
	for ms in milestones:
		print(f"    - {ms['title']}: {ms['progress_pct']}% ({ms['closed_issues']}/{ms['total_issues']})", file=sys.stderr)

	# 貢献度データを統合
	contributor_activity = merge_contributor_activity(
		merged_activity, open_activity, review_activity
	)

	# 出力
	output = {
		"metadata": {
			"period": period_label,
			"days": args.days,
			"start_utc": start_utc.isoformat(),
			"end_utc": end_utc.isoformat(),
			"repository": f"{args.owner}/{args.repo}",
		},
		"prs": {
			"merged": merged_prs,
			"open": open_prs,
			"summary": {
				"merged_count": len(merged_prs),
				"open_count": len(open_prs),
				"awaiting_review_count": awaiting,
				"feedback_in_progress_count": feedback,
				"approved_count": approved,
				"draft_count": draft,
			},
		},
		"issues": {
			"closed_count": closed_issue_count,
			"closed": closed_issues,
		},
		"milestones": milestones,
		# コミット数は get_commits.py の出力と main.py でマージする
		"contributor_activity": contributor_activity,
	}

	print("\n=== 完了 ===", file=sys.stderr)
	print(f"マージ済みPR     : {len(merged_prs)}", file=sys.stderr)
	print(f"オープンPR       : {len(open_prs)}", file=sys.stderr)
	print(f"クローズしたIssue : {closed_issue_count}", file=sys.stderr)
	print(f"貢献者数       : {len(contributor_activity)}", file=sys.stderr)

	json_str = json.dumps(output, ensure_ascii=False, indent=2)

	if args.output:
		from pathlib import Path
		output_path = Path("output") / "report_data.json"
		output_path.parent.mkdir(exist_ok=True)
		output_path.write_text(json_str, encoding="utf-8")
		print(f"\n✅ 出力完了: {output_path}", file=sys.stderr)
	else:
		print(json_str)


if __name__ == "__main__":
	main()

