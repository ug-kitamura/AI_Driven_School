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
			"--include-pages-url",
			action="store_true",
			help="デプロイ済みの GitHub Pages URL を通知文に含める",
		)

	def run(self) -> None:
		self.print_section("レポートを通知中")

		slack_bot_token = getattr(self.args, "slack_bot_token", None) or os.environ.get("SLACK_BOT_TOKEN")
		slack_channel_id = getattr(self.args, "slack_channel_id", None) or os.environ.get("SLACK_CHANNEL_ID")

		if not slack_bot_token or not slack_channel_id:
			print(
				"ℹ️ Slack通知設定が未指定のためスキップします（--slack-bot-token / --slack-channel-id または環境変数）",
				file=sys.stderr,
			)
			return

		report_data = self._load_report_data()
		payload = self._build_slack_payload(report_data, self.args.include_pages_url)
		self._send_to_slack(slack_bot_token, slack_channel_id, payload)

	def _load_report_data(self) -> dict:
		path = self.OUTPUT_DIR / "report_data.json"
		if not path.exists():
			print(f"⚠️ 集計ファイルが見つかりません: {path}", file=sys.stderr)
			sys.exit(1)
		return self.load_json("report_data.json")

	def _build_slack_payload(self, report_data: dict, include_pages_url: bool) -> dict:
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

		text = (
			f"Comitora report | {period_label} | {repo_name} | "
			f"health={health_pct}% merged={prs_merged} awaiting={awaiting_review} "
			f"feedback_in_progress={feedback_in_progress} "
			f"branches={active_branches} open_issues={open_issues}"
		)

		blocks = [
			{
				"type": "header",
				"text": {"type": "plain_text", "text": "Comitora Report", "emoji": True},
			},
			{
				"type": "section",
				"text": {
					"type": "mrkdwn",
					"text": f"*{period_label}*  •  *{repo_name}*\n<{repo_url}|GitHub Repository>",
				},
			},
			{
				"type": "section",
				"fields": [
					{"type": "mrkdwn", "text": f"*Generated at*\n`{generated_at}`"},
					{"type": "mrkdwn", "text": f"*Health*\n`{health_pct}%`"},
					{"type": "mrkdwn", "text": f"*PRs merged*\n`{prs_merged}`"},
					{"type": "mrkdwn", "text": f"*Awaiting review*\n`{awaiting_review}`"},
					{"type": "mrkdwn", "text": f"*Feedback in progress*\n`{feedback_in_progress}`"},
					{"type": "mrkdwn", "text": f"*Active branches*\n`{active_branches}`"},
					{"type": "mrkdwn", "text": f"*Open issues*\n`{open_issues}`"},
				],
			},
		]

		if include_pages_url:
			pages_url = f"https://{self.args.owner}.github.io/{self.args.repo}/"
			blocks.append(
				{
					"type": "section",
					"text": {
						"type": "mrkdwn",
						"text": (
							f"🌐 詳細レポートは GitHub Pages で確認できます: <{pages_url}|Open report page>\n"
							"ブラウザからアクセスして、コミとらレポートを確認してください。"
						),
					},
				}
			)

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

