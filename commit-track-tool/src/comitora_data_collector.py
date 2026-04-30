"""
comitora_data_collector.py - GitHub データ取得・集計クラス

処理内容:
	- GitHub API でコミット・PR・Issue・Milestone データを取得
	- 貢献スコアを算出してコントリビューターをランク付け
	- 集計結果を ../output/ に保存

出力ファイル:
	../output/commits.json         コミットデータ（生）
	../output/report_data.json     PR・Issue・Milestone データ（生）
	../output/aggregated_data.json Claude に渡す集計済みデータ

単体実行:
	python comitora_data_collector.py --owner your-org --repo your-repo
"""

import os
import sys
import argparse
from comitora_base import ComitoraBase
from github_client import GitHubClient


class DataCollector(ComitoraBase):
	"""GitHub からデータを取得し、レポート用に集計する。"""

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
			help   = ".gitignoreによるファイルフィルタを無効化する",
		)
		parser.add_argument(
			"--token",
			default = None,
			help    = "GitHub APIトークン（省略時は環境変数 GH_TOKEN）",
		)

	def run(self) -> None:
		token = self.args.token or os.environ.get("GH_TOKEN")
		if not token:
			print("❌ --token または環境変数 GH_TOKEN でトークンを指定してください", file=sys.stderr)
			sys.exit(1)

		client = GitHubClient(token, self.args.owner, self.args.repo)

		# Step 1: コミット取得
		self.print_section("GitHub コミットデータを取得中")
		commits_data = client.fetch_commits(
			days          = self.args.days,
			active_days   = self.args.active_days,
			concurrency   = self.args.concurrency,
			use_gitignore = not self.args.no_gitignore,
		)
		self.save_json("commits.json", commits_data)

		# Step 2: PR・Issue・Milestone 取得
		self.print_section("PR・Issue・Milestone データを取得中")
		report_data = client.fetch_report_data(
			days        = self.args.days,
			active_days = self.args.active_days,
		)
		self.save_json("report_data.json", report_data)

		# Step 3: 集計
		self.print_section("データを集計中")
		aggregated = self._aggregate(commits_data, report_data)
		self.save_json("aggregated_data.json", aggregated)

		# サマリー出力
		hero = aggregated.get("hero")
		print(f"  コミット数: {aggregated['stats']['commits']}", file=sys.stderr)
		print(f"  マージ済みPR: {aggregated['stats']['merged_prs']}", file=sys.stderr)
		print(f"  進捗度: {aggregated['progress']['progress_pct']}%", file=sys.stderr)
		print(f"  ユニークファイル数: {aggregated['stats']['unique_files_changed']}", file=sys.stderr)
		if hero:
			print(f"  今週のヒーロー: {hero['login']} (スコア: {hero['score']})", file=sys.stderr)

	# ------------------------------------------------------------------
	# 集計ロジック
	# ------------------------------------------------------------------

	def _aggregate(self, commits_data: dict, report_data: dict) -> dict:
		"""
		コミットデータと PR/Issue/Milestone データを統合して集計する。

		- コミット数・ユニークファイル数を人ごとに集計
		- 貢献スコア = コミット数×1 + マージPR数×3 + レビュー数×2
		- スコア順にランク付けし、1位をヒーローとして設定
		- 進捗度 = マージ済みPR / (マージ済みPR + オープンPR) × 100
		"""
		commit_count_by_author: dict[str, int] = {}
		unique_files: set[str] = set()
		avatar_map: dict[str, str] = {}

		for commit in commits_data.get("commits", []):
			login = commit["author"]["login"]
			commit_count_by_author[login] = commit_count_by_author.get(login, 0) + 1
			avatar_map.setdefault(login, commit["author"].get("avatar_url", ""))
			for f in commit.get("files", []):
				unique_files.add(f["path"])

		# contributor_activity をベースに全メンバーをマージ
		contributor_activity: dict[str, dict] = {
			login: dict(data)
			for login, data in report_data.get("contributor_activity", {}).items()
		}
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
			data["commits"] = commit_count_by_author.get(login, 0)
			data["score"] = (
				data["commits"] * 1
				+ data.get("prs_merged", 0) * 3
				+ data.get("reviews_submitted", 0) * 2
			)

		contributors_ranked = sorted(
			contributor_activity.values(),
			key     = lambda x: x["score"],
			reverse = True,
		)
		for i, c in enumerate(contributors_ranked, 1):
			c["rank"] = i

		hero = contributors_ranked[0] if contributors_ranked else None

		summary      = report_data["prs"]["summary"]
		merged_count = summary["merged_count"]
		open_count   = summary["open_count"]
		total_prs    = merged_count + open_count
		progress_pct = round(merged_count / total_prs * 100) if total_prs > 0 else 0

		return {
			"metadata": {
				"period"      : commits_data["metadata"]["period"],
				"days"        : commits_data["metadata"]["days"],
				"start_utc"   : commits_data["metadata"]["start_utc"],
				"end_utc"     : commits_data["metadata"]["end_utc"],
				"repository"  : commits_data["metadata"]["repository"],
				"generated_at": self.now_jst().isoformat(),
			},
			"progress": {
				"progress_pct": progress_pct,
				"merged_prs"  : merged_count,
				"open_prs"    : open_count,
			},
			"stats": {
				"merged_prs"          : merged_count,
				"open_prs"            : open_count,
				"awaiting_review"     : summary["awaiting_review_count"],
				"feedback_in_progress": summary["feedback_in_progress_count"],
				"approved"            : summary["approved_count"],
				"draft"               : summary["draft_count"],
				"closed_issues"       : report_data["issues"]["closed_count"],
				"commits"             : commits_data["metadata"]["total_commits"],
				"unique_files_changed": len(unique_files),
			},
			"prs"                : report_data["prs"],
			"issues"             : report_data["issues"],
			"milestones"         : report_data["milestones"],
			"contributors_ranked": contributors_ranked,
			"hero"               : hero,
			"commits"            : commits_data.get("commits", []),
		}


# ------------------------------------------------------------------
# 単体実行
# ------------------------------------------------------------------

if __name__ == "__main__":
	parser = DataCollector.build_parser("GitHub データを取得・集計して ../output/ に保存する")
	DataCollector(parser.parse_args()).run()

