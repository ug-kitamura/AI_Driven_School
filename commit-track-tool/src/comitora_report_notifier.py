"""
comitora_report_notifier.py - レポート通知クラス（Slack / メール など）

処理内容:
	- ../output/weekly_report.html を読み込み、設定した通知先に送信する

現状は未実装のプレースホルダーです。
今後 Slack Webhook や SMTP を使った通知機能をここに追加してください。

単体実行:
	python comitora_report_notifier.py --owner your-org --repo your-repo
"""

import sys
import argparse
from comitora_base import ComitoraBase


class ReportNotifier(ComitoraBase):
	"""週次レポートを外部サービスに通知する。"""

	@classmethod
	def add_args(cls, parser: argparse.ArgumentParser) -> None:
		parser.add_argument(
			"--slack-webhook",
			dest="slack_webhook",
			default=None,
			help="Slack Incoming Webhook URL（省略時は通知をスキップ）",
		)

	def run(self) -> None:
		self.print_section("レポートを通知中")

		if not getattr(self.args, "slack_webhook", None):
			print("  ℹ️  通知先が未設定のためスキップします（--slack-webhook で指定可能）", file=sys.stderr)
			return

		html_path = self.output_dir / "weekly_report.html"
		if not html_path.exists():
			print(f"  ⚠️  レポートファイルが見つかりません: {html_path}", file=sys.stderr)
			return

		# TODO: Slack / メール などへの通知実装
		print("  🚧 通知機能は未実装です", file=sys.stderr)


# ------------------------------------------------------------------
# 単体実行
# ------------------------------------------------------------------

if __name__ == "__main__":
	parser = ReportNotifier.build_parser("生成済みレポートを外部サービスに通知する")
	ReportNotifier(parser.parse_args()).run()

