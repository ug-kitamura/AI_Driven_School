"""
comitora_data_collector.py - GitHub データ取得・集計クラス

処理内容:
	Step 1: コミット取得（ブランチ一覧 → コミット → 変更ファイル）
	Step 2: PR 取得（マージ済み / オープン / レビュー実績）
	Step 3: Issue・Milestone 取得
	Step 4: 集計（貢献スコア・進捗度・ヒーロー算出）

出力ファイル:
	../output/report_data.json  ReportGenerator に渡す集計済みデータ

単体実行:
	python comitora_data_collector.py --owner your-org --repo your-repo
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from comitora_base import ComitoraBase
from github_client import GitHubClient, parse_date_range

try:
	load_dotenv()
except ImportError:
	load_dotenv(Path(__file__).parent.parent / ".env")


class DataCollector(ComitoraBase):
	"""GitHub からデータを取得し、レポート用に集計する。"""

	@classmethod
	def add_args(cls, parser: argparse.ArgumentParser) -> None:
		parser.add_argument("--concurrency", type=int, default=5,
							help="ファイル取得の並列リクエスト数（デフォルト: 5）")
		parser.add_argument("--no-gitignore", action="store_true",
							help=".gitignore によるファイルフィルタを無効化する")
		parser.add_argument("--token", default=None,
							help="GitHub APIトークン（省略時は環境変数 GH_TOKEN）")

	def run(self) -> None:
		token = self.args.token or os.environ.get("GH_TOKEN")
		if not token:
			print("❌ --token または環境変数 GH_TOKEN でトークンを指定してください", file=sys.stderr)
			sys.exit(1)

		client = GitHubClient(token, self.args.owner, self.args.repo)
		start_utc, end_utc, period_label = parse_date_range(self.args.days)
		active_since = end_utc - timedelta(days=self.args.active_days)

		# Step 1: コミット取得
		self.print_section("Step 1: コミットデータを取得中")
		commits_data = self._fetch_commits(client, start_utc, end_utc)

		# Step 2: PR 取得
		self.print_section("Step 2: PR データを取得中")
		prs_data, contributor_activity = self._fetch_prs(client, start_utc, end_utc, active_since)
		s = prs_data["summary"]
		print(f"マージ済みPR: {s['merged_count']}", file=sys.stderr)
		print(f"オープンPR: {s['open_count']}")
		print(f" |- レビュー待ち: {s['awaiting_review_count']}")
		print(f" |- フィードバック対応中: {s['feedback_in_progress_count']}")
		print(f" |- 承認済み: {s['approved_count']}")
		print(f" |- ドラフト: {s['draft_count']}")

		# Step 3: Issue・Milestone 取得
		self.print_section("Step 3: Issue・Milestone データを取得中")
		issues_data, milestones = self._fetch_issues_milestones(client, start_utc, end_utc)
		print(f"クローズしたIssue: {issues_data['closed_count']}", file=sys.stderr)
		print(f"オープンなIssue : {issues_data['open_count']}", file=sys.stderr)
		print(f"アクティブマイルストーン: {len(milestones)}", file=sys.stderr)

		# Step 4: 集計
		self.print_section("Step 4: データを集計中")
		report_data = self._aggregate(
			commits_data, prs_data, contributor_activity,
			issues_data, milestones,
			period_label, start_utc, end_utc,
		)

		hero = report_data.get("hero")
		print(f"進捗度: {report_data['progress']['progress_pct']}%", file=sys.stderr)
		print(f"ユニークファイル数: {report_data['stats']['unique_files_changed']}", file=sys.stderr)
		if hero:
			print(f"今週のヒーロー: {hero['login']} (スコア: {hero['score']})", file=sys.stderr)

		self.save_json("report_data.json", report_data)

	# ------------------------------------------------------------------
	# Step 1: コミット取得
	# ------------------------------------------------------------------

	def _fetch_commits(
		self, client: GitHubClient, start_utc, end_utc
	) -> dict:
		"""ブランチ一覧 → アクティブブランチ → コミット → 変更ファイルの順で取得する。"""
		spec = client.get_gitignore_spec() if not self.args.no_gitignore else None

		branches, default_branch = client.get_branches()
		active_branches = client.filter_active_branches(branches, self.args.active_days, end_utc)
		print(f"総ブランチ数: {len(branches)}, アクティブ: {len(active_branches)}", file=sys.stderr)

		all_commits: list[dict] = []
		seen: set[str] = set()
		for i, branch in enumerate(active_branches, 1):
			print(f" |- [{i}/{len(active_branches)}] {branch['name']} ...", file=sys.stderr)
			for c in client.get_branch_commits(branch["name"], start_utc, end_utc):
				if c["sha"] not in seen:
					seen.add(c["sha"])
					all_commits.append(c)

		print(f"総コミット数（重複排除）: {len(all_commits)}", file=sys.stderr)

		if all_commits:
			concurrency = self.args.concurrency
			print(f"変更ファイルを取得中（並列数: {concurrency}）...", file=sys.stderr)

			def _fetch_files(commit: dict) -> None:
				files = client.get_commit_files(commit["sha"])
				if spec:
					files = [f for f in files if not spec.match_file(f["path"])]
				commit["files"] = files

			done = 0
			with ThreadPoolExecutor(max_workers=concurrency) as ex:
				futures = {ex.submit(_fetch_files, c): c["sha"] for c in all_commits}
				for fut in as_completed(futures):
					fut.result()
					done += 1
					if done % 10 == 0 or done == len(all_commits):
						print(f" |- ファイル取得進捗: {done}/{len(all_commits)}", file=sys.stderr)

		return {
			"default_branch" : default_branch,
			"total_branches" : len(branches),
			"active_branches": len(active_branches),
			"commits"        : all_commits,
		}

	# ------------------------------------------------------------------
	# Step 2: PR 取得
	# ------------------------------------------------------------------

	def _fetch_prs(
		self, client: GitHubClient, since, until, active_since
	) -> tuple[dict, dict]:
		"""マージ済み PR・オープン PR・レビュー実績を取得してまとめる。"""
		merged_prs, merged_activity = client.get_merged_prs(since, until, active_since)
		open_prs,   open_activity   = client.get_open_prs()
		all_pr_numbers = [p["number"] for p in merged_prs] + [p["number"] for p in open_prs]
		review_activity = client.get_reviews(all_pr_numbers, since, until)

		total_reviews = sum(a["reviews_submitted"] for a in review_activity.values())
		print(f"期間内レビュー数: {total_reviews}", file=sys.stderr)

		awaiting = sum(1 for p in open_prs if p["review_status"] == "awaiting_review")
		feedback = sum(1 for p in open_prs if p["review_status"] == "feedback_in_progress")
		approved = sum(1 for p in open_prs if p["review_status"] == "approved")
		draft    = sum(1 for p in open_prs if p["review_status"] == "draft")

		contributor_activity = self._merge_contributor_activity(
			merged_activity, open_activity, review_activity
		)

		prs_data = {
			"merged": merged_prs,
			"open"  : open_prs,
			"summary": {
				"merged_count"              : len(merged_prs),
				"open_count"                : len(open_prs),
				"awaiting_review_count"     : awaiting,
				"feedback_in_progress_count": feedback,
				"approved_count"            : approved,
				"draft_count"               : draft,
			},
		}
		return prs_data, contributor_activity

	# ------------------------------------------------------------------
	# Step 3: Issue・Milestone 取得
	# ------------------------------------------------------------------

	def _fetch_issues_milestones(
		self, client: GitHubClient, since, until
	) -> tuple[dict, list]:
		"""クローズした Issue・オープンな Issue とマイルストーンを取得する。"""
		closed_count, closed_issues = client.get_closed_issues(since, until)
		open_count,   open_issues   = client.get_open_issues()
		milestones = client.get_milestones()
		return {
			"closed_count": closed_count,
			"closed"      : closed_issues,
			"open_count"  : open_count,
			"open"        : open_issues,
		}, milestones

	# ------------------------------------------------------------------
	# Step 4: 集計
	# ------------------------------------------------------------------

	def _aggregate(
		self,
		commits_data        : dict,
		prs_data            : dict,
		contributor_activity: dict,
		issues_data         : dict,
		milestones          : list,
		period_label        : str,
		start_utc,
		end_utc,
	) -> dict:
		"""
		各データを統合して Claude に渡す集計済みレポートデータを生成する。

		- コミット数・ユニークファイル数を人ごとに集計
		- 貢献スコア = コミット数×1 + マージPR数×3 + レビュー数×2
		- スコア順にランク付けし、1位をヒーローとして設定
		- 進捗度 = マージ済みPR / (マージ済みPR + オープンPR) × 100
		"""
		commit_count_by_author: dict[str, int] = {}
		unique_files: set[str]  = set()
		avatar_map:  dict[str, str] = {}

		for commit in commits_data["commits"]:
			login = commit["author"]["login"]
			commit_count_by_author[login] = commit_count_by_author.get(login, 0) + 1
			avatar_map.setdefault(login, commit["author"].get("avatar_url", ""))
			for f in commit.get("files", []):
				unique_files.add(f["path"])

		# クローズした Issue の closed_by を contributor_activity に集計
		issues_closed_by: dict[str, int] = {}
		for issue in issues_data.get("closed", []):
			login = issue.get("closed_by")
			if login:
				issues_closed_by[login] = issues_closed_by.get(login, 0) + 1
				if login not in contributor_activity:
					contributor_activity[login] = {
						"login"            : login,
						"avatar_url"       : issue.get("closed_by_avatar", ""),
						"prs_created"      : 0,
						"prs_merged"       : 0,
						"reviews_submitted": 0,
					}

		# コミットのみのメンバーを contributor_activity に追加
		for login in commit_count_by_author:
			if login not in contributor_activity:
				contributor_activity[login] = {
					"login"            : login,
					"avatar_url"       : avatar_map.get(login, ""),
					"prs_created"      : 0,
					"prs_merged"       : 0,
					"reviews_submitted": 0,
				}

		for login, data in contributor_activity.items():
			data["commits"]       = commit_count_by_author.get(login, 0)
			data["issues_closed"] = issues_closed_by.get(login, 0)
			data["score"]         = (
				data["commits"] * 1
				+ data.get("prs_merged", 0) * 3
				+ data.get("reviews_submitted", 0) * 2
				+ data["issues_closed"] * 1
			)

		contributors_ranked = sorted(
			contributor_activity.values(),
			key=lambda x: x["score"],
			reverse=True,
		)
		for i, c in enumerate(contributors_ranked, 1):
			c["rank"] = i

		hero    = contributors_ranked[0] if contributors_ranked else None
		summary = prs_data["summary"]
		merged_count = summary["merged_count"]
		open_count   = summary["open_count"]
		total_prs    = merged_count + open_count
		progress_pct = round(merged_count / total_prs * 100) if total_prs > 0 else 0

		return {
			"metadata": {
				"period"        : period_label,
				"days"          : self.args.days,
				"start_utc"     : start_utc.isoformat(),
				"end_utc"       : end_utc.isoformat(),
				"repository"    : f"{self.args.owner}/{self.args.repo}",
				"default_branch": commits_data["default_branch"],
				"generated_at"  : self.now_jst().isoformat(),
			},
			"progress": {
				"progress_pct": progress_pct,
				"merged_prs"  : merged_count,
				"open_prs"    : open_count,
			},
			"stats": {
				"merged_prs"           : merged_count,
				"open_prs"             : open_count,
				"awaiting_review"      : summary["awaiting_review_count"],
				"feedback_in_progress" : summary["feedback_in_progress_count"],
				"approved"             : summary["approved_count"],
				"draft"                : summary["draft_count"],
				"closed_issues"        : issues_data["closed_count"],
				"open_issues"          : issues_data["open_count"],
				"commits"              : len(commits_data["commits"]),
				"unique_files_changed" : len(unique_files),
			},
			"prs"               : prs_data,
			"issues"            : issues_data,
			"milestones"        : milestones,
			"contributors_ranked": contributors_ranked,
			"hero"              : hero,
			"commits"           : commits_data["commits"],
		}

	@staticmethod
	def _merge_contributor_activity(*dicts: dict) -> dict:
		"""複数の contributor_activity dict を統合する。"""
		merged: dict[str, dict] = {}
		for activity in dicts:
			for login, data in activity.items():
				if login not in merged:
					merged[login] = dict(data)
				else:
					merged[login]["prs_created"]       += data.get("prs_created", 0)
					merged[login]["prs_merged"]        += data.get("prs_merged", 0)
					merged[login]["reviews_submitted"] += data.get("reviews_submitted", 0)
		return merged


# ------------------------------------------------------------------
# 単体実行
# ------------------------------------------------------------------

if __name__ == "__main__":
	parser = DataCollector.build_parser(
		"GitHub データを取得・集計して ../output/report_data.json に保存する"
	)
	DataCollector(parser.parse_args()).run()
