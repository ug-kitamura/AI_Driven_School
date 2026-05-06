"""
comitora_report_notifier.py - レポート通知クラス（Slack など）

処理内容:
	- output/report_data.json を読み込み、Slack にサマリー投稿する

単体実行（commit-track-tool/ から実行）:
	uv run python src/comitora_report_notifier.py --owner ... --repo ...
"""

import os
import sys
import requests
import argparse
from comitora_base import ComitoraBase


class ReportNotifier(ComitoraBase):
	"""レポートを外部サービスに通知する。"""

	@classmethod
	def add_args(cls, parser: argparse.ArgumentParser) -> None:
		parser.add_argument(
			"--slack-bot-token",
			dest="slack_bot_token",
			default=None,
			help="Slack Bot Token（省略時は環境変数 SLACK_BOT_TOKEN）",
		)
		parser.add_argument(
			"--slack-channel-id",
			dest="slack_channel_id",
			default=None,
			help="Slack Channel ID（省略時は環境変数 SLACK_CHANNEL_ID）",
		)
		parser.add_argument(
			"--include-page-url",
			action="store_true",
			help="デプロイ済みの GitHub Pages URL を通知文に含める",
		)
		parser.add_argument(
			"--skip-slack",
			action="store_true",
			help="Slack 通知を無効にする（環境変数があっても投稿しない）",
		)

	def run(self) -> None:
		self.print_section("レポートを通知中")
		if getattr(self.args, "skip_slack", False):
			print("ℹ️ --skip-slack が指定されたため、Slack通知をスキップします", file=sys.stderr)
			return

		slack_bot_token = getattr(self.args, "slack_bot_token", None) or os.environ.get("SLACK_BOT_TOKEN")
		slack_channel_id = getattr(self.args, "slack_channel_id", None) or os.environ.get("SLACK_CHANNEL_ID")

		if not slack_bot_token or not slack_channel_id:
			print(
				"ℹ️ Slack通知設定が未指定のためスキップします（--slack-bot-token / --slack-channel-id または環境変数）",
				file=sys.stderr,
			)
			return

		report_data = self._load_report_data()
		payload = self._build_slack_payload(report_data, self.args.include_page_url)
		self._send_to_slack(slack_bot_token, slack_channel_id, payload)

	def _load_report_data(self) -> dict:
		path = self.OUTPUT_DIR / "report_data.json"
		if not path.exists():
			print(f"⚠️ 集計ファイルが見つかりません: {path}", file=sys.stderr)
			sys.exit(1)
		return self.load_json("report_data.json")

	def _build_slack_payload(self, report_data: dict, include_page_url: bool) -> dict:
		metadata             = report_data.get("metadata", {})
		pr_summary           = report_data.get("pr", {}).get("summary", {})
		issue                = report_data.get("issue", {})
		branch               = report_data.get("branch", {})
		aggregate            = report_data.get("aggregate", {})
		repo_name            = metadata.get("repository", f"{self.args.owner}/{self.args.repo}")
		period_label         = metadata.get("period", f"直近{self.args.days}日")
		repo_url             = f"https://github.com/{self.args.owner}/{self.args.repo}"
		generated_at         = metadata.get("generated_at", "unknown")
		health_pct           = aggregate.get("health", {}).get("pct", "N/A")
		prs_merged           = pr_summary.get("merged_count", 0)
		awaiting_review      = pr_summary.get("awaiting_review_count", 0)
		feedback_in_progress = pr_summary.get("feedback_in_progress_count", 0)
		active_branches      = len(branch.get("active_branches") or [])
		open_issues          = issue.get("open_count", 0)

		try:
			hp = int(health_pct)
		except (TypeError, ValueError):
			health_icon = ":white_circle:"
		else:
			if hp >= 80:
				health_icon = ":large_blue_circle:"
			elif hp >= 50:
				health_icon = ":large_yellow_circle:"
			else:
				health_icon = ":red_circle:"

		health_value = f"`{health_pct}%`" if health_pct != "N/A" else "`N/A`"
		lines = [
			f"*対象リポジトリ:*  <{repo_url}|*{repo_name}*>",
			f"*{period_label}*",
			f"*プロジェクト健全度: {health_icon}*",
			"\n",
			f"• マージ済み PR:  `{prs_merged}`",
			f"• レビュー待ち PR:  `{awaiting_review}`",
			f"• フィードバック対応中 PR:  `{feedback_in_progress}`",
			f"• アクティブ Branch:  `{active_branches}`",
			f"• オープン Issue:  `{open_issues}`",
		]

		if include_page_url:
			pages_url = f"https://{self.args.owner}.github.io/{self.args.repo}/"
			lines.extend(
				[
					"\n",
					f":bar_chart: *詳細レポート*: <{pages_url}|*Comitora Report*>",
				]
			)

		markdown_text = "\n".join(lines)
		text = f"Comitora report | {period_label} | {repo_name}"
		blocks = [{"type": "section", "text": {"type": "mrkdwn", "text": markdown_text}}]
		return {"text": text, "blocks": blocks}

	def _send_to_slack(self, token: str, channel_id: str, payload: dict) -> None:
		url = "https://slack.com/api/chat.postMessage"
		headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=utf-8"}
		body = {"channel": channel_id, **payload}

		try:
			resp = requests.post(url, headers=headers, json=body, timeout=60)
			resp.raise_for_status()
		except requests.RequestException as e:
			print(f"❌ Slack への投稿に失敗しました: {e}", file=sys.stderr)
			sys.exit(1)

		resp_body = resp.json()
		if not resp_body.get("ok"):
			print(f"❌ Slack API エラー: {resp_body.get('error', 'unknown_error')}", file=sys.stderr)
			sys.exit(1)

		print(f"📨 Slack にサマリー投稿しました: channel={channel_id}", file=sys.stderr)


# ------------------------------------------------------------------
# 単体実行
# ------------------------------------------------------------------

if __name__ == "__main__":
	parser = ReportNotifier.build_parser("生成済みレポートを外部サービスに通知する")
	ReportNotifier(parser.parse_args()).run()

