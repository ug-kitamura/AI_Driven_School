"""
comitora_data_collector.py - GitHub データ取得・集計クラス

処理内容:
	Step 1: コミット取得（ブランチ一覧 → コミット → 変更ファイル）
	Step 2: PR 取得（マージ済み / オープン / レビュー実績）
	Step 3: Issue・Milestone 取得
	Step 4: 集計（貢献スコア・プロジェクト健全度・ヒーロー算出）

出力ファイル:
	output/report_data.json  ReportGenerator に渡す集計済みデータ

単体実行（commit-track-tool/ から実行）:
	uv run python src/comitora_data_collector.py --owner ... --repo ...
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from comitora_base import ComitoraBase
from github_client import GitHubClient


class DataCollector(ComitoraBase):
	"""GitHub からデータを取得し、レポート用に集計する。"""

	contributor_activity: dict[str, dict] = {}

	@classmethod
	def add_args(cls, parser: argparse.ArgumentParser) -> None:
		parser.add_argument(
			"--concurrency",
			type    = int,
			default = 5,
			help    = "ファイル取得の並列リクエスト数（デフォルト: 5）",
		)
		parser.add_argument(
			"--no-gitignore",
			action = "store_true",
			help   = ".gitignore によるファイルフィルタを無効化する",
		)
		parser.add_argument(
			"--token",
			default = None,
			help    = "GitHub APIトークン（省略時は環境変数 GITHUB_TOKEN）",
		)

	def run(self) -> None:
		token = self.args.token or os.environ.get("GITHUB_TOKEN")
		if not token:
			print("❌ --token または環境変数 GITHUB_TOKEN でトークンを指定してください", file=sys.stderr)
			sys.exit(1)

		client = GitHubClient(token, self.args.owner, self.args.repo)
		start_utc, end_utc, period_label = self.parse_date_range(self.args.days)
		active_since = end_utc - timedelta(days=self.args.active_days)

		# Step 0: メタ情報取得
		self.print_section("Step 0: メタ情報を取得")
		self._fetch_meta(start_utc, end_utc, period_label)

		# Step 1: ブランチ取得
		self.print_section("Step 1: ブランチデータを取得")
		self._fetch_branches(client, end_utc)

		# Step 2: コミット取得
		self.print_section("Step 2: コミットデータを取得")
		self._fetch_commits(client, start_utc, end_utc)

		# Step 3: PR 取得
		self.print_section("Step 3: PR データを取得")
		self._fetch_prs(client, start_utc, end_utc, active_since)

		# Step 4: Issue・Milestone 取得
		self.print_section("Step 4: Issue・Milestone データを取得")
		self._fetch_issues_milestones(client, start_utc, end_utc)

		# Step 5: 集計
		self.print_section("Step 5: データを集計")
		self._aggregate()

		# Step 6: 保存
		self.print_section("Step 6: データを保存")
		self.save_json("report_data.json", self.REPORT_DATA)

		if self.DEBUG:
			print(json.dumps(self.REPORT_DATA, indent=4, ensure_ascii=False))

	# ------------------------------------------------------------------
	# Step 0: メタ情報取得
	# ------------------------------------------------------------------

	def _fetch_meta(
		self, start_utc, end_utc, period_label
	) -> None:
		"""メタ情報を取得する。"""

		meta_data = {
			"period"      : period_label,
			"days"        : self.args.days,
			"start_utc"   : start_utc.isoformat(),
			"end_utc"     : end_utc.isoformat(),
			"repository"  : f"{self.args.owner}/{self.args.repo}",
			"generated_at": self.NOW_LOCAL.strftime("%Y/%m/%d %H:%M"),
		}
		self.REPORT_DATA["metadata"] = meta_data

		print(f"データ取得期間: {period_label}", file=sys.stderr)
		print(f"対象リポジトリ: {meta_data['repository']}", file=sys.stderr)
		print(f"データ取得日時: {meta_data['generated_at']}", file=sys.stderr)

	# ------------------------------------------------------------------
	# Step 1: ブランチ取得
	# ------------------------------------------------------------------

	def _fetch_branches(
		self, client: GitHubClient, end_utc
	) -> None:
		"""ブランチ一覧 → アクティブブランチの順で取得する。"""

		branches, default_branch = client.get_branches()
		active_branches = client.filter_active_branches(branches, self.args.active_days, end_utc)
		branch_data = {
			"default_branch" : default_branch,
			"active_branches": active_branches,
		}
		self.REPORT_DATA["branch"] = branch_data

		print(f"総ブランチ数: {len(branches)}, アクティブ: {len(active_branches)}", file=sys.stderr)
		for i, branch in enumerate(active_branches, 1):
			print(f" |- [{i}/{len(active_branches)}] {branch['name']} ...", file=sys.stderr)

	# ------------------------------------------------------------------
	# Step 2: コミット取得
	# ------------------------------------------------------------------

	def _fetch_commits(
		self, client: GitHubClient, start_utc, end_utc
	) -> None:
		"""コミット → 変更ファイルの順で取得する。"""

		seen: set[str] = set()
		commits_data: list[dict] = []
		active_branches = self.REPORT_DATA["branch"]["active_branches"]

		for i, branch in enumerate(active_branches, 1):
			for c in client.get_branch_commits(branch["name"], start_utc, end_utc):
				if c["sha"] not in seen:
					seen.add(c["sha"])
					commits_data.append(c)

		print(f"総コミット数（重複排除）: {len(commits_data)}", file=sys.stderr)

		if commits_data:
			spec = client.get_gitignore_spec() if not self.args.no_gitignore else None
			concurrency = self.args.concurrency
			print(f"変更ファイルを取得中（並列数: {concurrency}）...", file=sys.stderr)

			def _fetch_files(commit: dict) -> None:
				files = client.get_commit_files(commit["sha"])
				if spec:
					files = [f for f in files if not spec.match_file(f["path"])]
				commit["files"] = files

			done = 0
			with ThreadPoolExecutor(max_workers=concurrency) as ex:
				futures = {ex.submit(_fetch_files, c): c["sha"] for c in commits_data}
				for fut in as_completed(futures):
					fut.result()
					done += 1
					if done % 10 == 0 or done == len(commits_data):
						print(f" |- ファイル取得進捗: {done}/{len(commits_data)}", file=sys.stderr)

		self.REPORT_DATA["commit"] = commits_data

	# ------------------------------------------------------------------
	# Step 3: PR 取得
	# ------------------------------------------------------------------

	def _fetch_prs(
		self, client: GitHubClient, since, until, active_since
	) -> None:
		"""マージ済み PR・オープン PR・レビュー実績を取得してまとめる。"""
		merged_prs, merged_activity = client.get_merged_prs(since, until, active_since)
		open_prs,   open_activity   = client.get_open_prs()
		all_pr_numbers = [p["number"] for p in merged_prs] + [p["number"] for p in open_prs]
		review_activity, pr_reviews_in_period = client.get_reviews(all_pr_numbers, since, until)

		total_reviews = sum(a["reviews_submitted"] for a in review_activity.values())
		frequent_review_threshold = 1
		frequent_review_pr_count = sum(
			1 for _n, cnt in pr_reviews_in_period.items() if cnt >= frequent_review_threshold
		)
		print(f"期間内レビュー数: {total_reviews}", file=sys.stderr)
		print(
			f"活発レビューPR数（各PR {frequent_review_threshold}件以上）: {frequent_review_pr_count}",
			file=sys.stderr,
		)

		awaiting = sum(1 for p in open_prs if p["review_status"] == "awaiting_review")
		feedback = sum(1 for p in open_prs if p["review_status"] == "feedback_in_progress")
		approved = sum(1 for p in open_prs if p["review_status"] == "approved")
		draft    = sum(1 for p in open_prs if p["review_status"] == "draft")

		self.contributor_activity = self._merge_contributor_activity(
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
				"period_review_count"       : total_reviews,
				"frequent_review_pr_count"  : frequent_review_pr_count,
			},
		}
		self.REPORT_DATA["pr"] = prs_data

		print(f"マージ済みPR: {len(merged_prs)}", file=sys.stderr)
		print(f"オープンPR: {len(open_prs)}", file=sys.stderr)
		print(f" |- レビュー待ち: {awaiting}", file=sys.stderr)
		print(f" |- フィードバック対応中: {feedback}", file=sys.stderr)
		print(f" |- 承認済み: {approved}", file=sys.stderr)
		print(f" |- ドラフト: {draft}", file=sys.stderr)

	# ------------------------------------------------------------------
	# Step 4: Issue・Milestone 取得
	# ------------------------------------------------------------------

	def _fetch_issues_milestones(
		self, client: GitHubClient, since, until
	) -> None:
		"""オープンな Issue・クローズした Issue とマイルストーンを取得する。"""
		open_count,   open_issues   = client.get_open_issues()
		closed_count, closed_issues = client.get_closed_issues(since, until)
		milestones = client.get_milestones()

		issue_data = {
			"open_count"  : open_count,
			"open"        : open_issues,
			"closed_count": closed_count,
			"closed"      : closed_issues,
			"milestone"   : milestones,
		}
		self.REPORT_DATA["issue"] = issue_data

		print(f"オープンなIssue: {open_count}", file=sys.stderr)
		print(f"クローズしたIssue: {closed_count}", file=sys.stderr)
		print(f"アクティブマイルストーン: {len(milestones)}", file=sys.stderr)

	# ------------------------------------------------------------------
	# Step 5: 集計
	# ------------------------------------------------------------------

	def _aggregate(
		self,
	) -> None:
		"""
		各データを統合して Claude に渡す集計済みレポートデータを生成する。
		- コミット数・ユニークファイル数を人ごとに集計
		- 貢献スコア = コミット数×1 + マージPR数×3 + レビュー数×2 + クローズIssue数x1
		- スコア順にランク付けし、1位をヒーローとして設定
		- プロジェクト健全度: PR・Issue・コミット・ブランチ・滞留 + 活発なレビューPR
		- aggregate.health.pct に 0〜100 のプロジェクト健全度を格納する
		"""
		commit_count_by_author: dict[str, int] = {}
		unique_files: set[str] = set()
		avatar_map: dict[str, str] = {}

		for commit in self.REPORT_DATA["commit"]:
			login = commit["author"]["login"]
			commit_count_by_author[login] = commit_count_by_author.get(login, 0) + 1
			avatar_map.setdefault(login, commit["author"].get("avatar_url", ""))
			for f in commit.get("files", []):
				unique_files.add(f["path"])

		# クローズした Issue の closed_by を contributor_activity に集計
		issues_closed_by: dict[str, int] = {}
		for issue in self.REPORT_DATA["issue"].get("closed", []):
			login = issue.get("closed_by")
			if login:
				issues_closed_by[login] = issues_closed_by.get(login, 0) + 1
				if login not in self.contributor_activity:
					self.contributor_activity[login] = {
						"login"            : login,
						"avatar_url"       : issue.get("closed_by_avatar", ""),
						"prs_created"      : 0,
						"prs_merged"       : 0,
						"reviews_submitted": 0,
						"issues_closed"    : 0,
					}

		# コミットのみのメンバーを contributor_activity に追加
		for login in commit_count_by_author:
			if login not in self.contributor_activity:
				self.contributor_activity[login] = {
					"login"            : login,
					"avatar_url"       : avatar_map.get(login, ""),
					"prs_created"      : 0,
					"prs_merged"       : 0,
					"reviews_submitted": 0,
					"issues_closed"    : 0,
				}

		for login, data in self.contributor_activity.items():
			data["commits"]       = commit_count_by_author.get(login, 0)
			data["issues_closed"] = issues_closed_by.get(login, 0)
			data["score"]         = (
				data["commits"] * 1
				+ data.get("prs_merged", 0) * 3
				+ data.get("reviews_submitted", 0) * 2
				+ data["issues_closed"] * 1
			)

		contributors_ranked = sorted(
			self.contributor_activity.values(),
			key=lambda x: x["score"],
			reverse=True,
		)
		for i, c in enumerate(contributors_ranked, 1):
			c["rank"] = i

		hero = contributors_ranked[0] if contributors_ranked else None
		pr_sum     = self.REPORT_DATA["pr"]["summary"]
		issue_sum  = self.REPORT_DATA["issue"]
		branch_sum = self.REPORT_DATA["branch"]
		health_pct, health_breakdown = self._flow_health_raw(
			merged_count=pr_sum["merged_count"],
			open_count=pr_sum["open_count"],
			closed_count=issue_sum.get("closed_count", 0),
			commit_count=len(self.REPORT_DATA["commit"]),
			awaiting=pr_sum.get("awaiting_review_count", 0),
			feedback=pr_sum.get("feedback_in_progress_count", 0),
			open_issues=issue_sum.get("open_count", 0),
			active_branches=len(branch_sum.get("active_branches") or []),
			frequent_review_pr_count=pr_sum.get("frequent_review_pr_count", 0),
		)

		aggregate_data = {
			"health": {
				"pct"       : health_pct,
				"breakdown" : health_breakdown,
			},
			"contributors_ranked": contributors_ranked,
			"hero": hero,
		}
		self.REPORT_DATA["aggregate"] = aggregate_data

		print(f"プロジェクト健全度: {health_pct}% (raw {health_breakdown.get('raw_score')})", file=sys.stderr)
		if hero:
			print(f"ヒーロー: {hero['login']} (スコア: {hero['score']})", file=sys.stderr)

	@staticmethod
	def _flow_health_raw(
		merged_count: int,
		open_count: int,
		closed_count: int,
		commit_count: int,
		awaiting: int,
		feedback: int,
		open_issues: int,
		active_branches: int,
		frequent_review_pr_count: int,
	) -> tuple[int, dict]:
		"""
		フロー健全性: PR 滞留・オープン Issue・多すぎるアクティブブランチで減点し、
		マージ比率・コミット活動・期間内 Issue クローズ・「活発なレビューが付いた PR 数」で加点する。
		raw はおおよそ負値〜80 を想定し、線形に 0〜100 へスケールする。
		活発レビュー PR: 対象期間内にその PR へ投稿されたレビューが 1 件以上。
		"""
		total_prs = merged_count + open_count
		if total_prs > 0:
			merge_ratio = merged_count / total_prs
			pr_points = 40.0 * merge_ratio
			pr_merge_ratio_pct = round(100.0 * merge_ratio, 1)
		else:
			pr_points = 20.0
			pr_merge_ratio_pct = None

		commit_pts = min(10.0, commit_count / 4.0)
		close_pts = min(15.0, 5.0 * float(closed_count))
		review_vitality_pts = min(15.0, 5.0 * float(frequent_review_pr_count))

		pr_stall = min(20.0, 4.0 * awaiting + 5.0 * feedback)
		issue_backlog = min(15.0, 0.5 * float(open_issues))
		branch_penalty = min(10.0, 2.0 * max(0, active_branches - 3))

		raw = (
			pr_points
			+ commit_pts
			+ close_pts
			+ review_vitality_pts
			- pr_stall
			- issue_backlog
			- branch_penalty
		)

		health_pct = int(round(max(0.0, min(100.0, raw * 100.0 / 80.0))))

		breakdown = {
			"pr_flow_points"           : round(pr_points, 1),
			"commit_activity_points"   : round(commit_pts, 1),
			"issue_close_points"       : round(close_pts, 1),
			"review_vitality_points"   : round(review_vitality_pts, 1),
			"frequent_review_pr_count" : frequent_review_pr_count,
			"stall_penalty"            : round(pr_stall, 1),
			"open_issue_penalty"       : round(issue_backlog, 1),
			"branch_penalty"           : round(branch_penalty, 1),
			"raw_score"                : round(raw, 1),
			"pr_merge_ratio_pct"       : pr_merge_ratio_pct,
		}
		return health_pct, breakdown

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

