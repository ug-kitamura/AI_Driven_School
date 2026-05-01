"""
main.py - Comitora 週次レポート生成オーケストレータ

処理フロー:
	DataCollector   → GitHub データ取得・集計   (output/aggregated_data.json)
	ReportGenerator → Claude でレポート生成・評価 (output/weekly_report.html)
	Notifier        → レポート通知              (Slack / メール など)

使い方:
	python main.py --owner your-org --repo your-repo

オプション:
	--owner          GitHubオーナー名（必須）
	--repo           リポジトリ名（必須）
	--days           直近何日分を対象とするか（デフォルト: 7）
	--active-days    アクティブブランチ判定日数（デフォルト: 30）
	--concurrency    ファイル取得並列数（デフォルト: 5）
	--no-gitignore   .gitignore フィルタを無効化
	--token          GitHub APIトークン（省略時は環境変数 GH_TOKEN）
	--anthropic-key  Anthropic APIキー（省略時は環境変数 ANTHROPIC_API_KEY）
	--skip-claude    Claude API をスキップ（データ取得のみ確認したい場合）
	--slack-webhook  Slack Incoming Webhook URL

環境変数:
	GH_TOKEN           GitHub APIトークン（--token 未指定時のフォールバック）
	ANTHROPIC_API_KEY  Anthropic APIキー（--anthropic-key 未指定時のフォールバック）
"""

import sys
import argparse
from comitora_base import OUTPUT_DIR
from comitora_data_collector import DataCollector
from comitora_report_notifier import ReportNotifier
from comitora_report_generator import ReportGenerator


def build_parser() -> argparse.ArgumentParser:
	parser = argparse.ArgumentParser(
		description="Comitora 週次レポートを生成する",
		formatter_class=argparse.RawDescriptionHelpFormatter,
	)
	DataCollector.add_common_args(parser)
	DataCollector.add_args(parser)
	ReportGenerator.add_args(parser)
	ReportNotifier.add_args(parser)
	return parser


def main() -> None:
	args = build_parser().parse_args()

	print(f"📁 出力先: {OUTPUT_DIR.resolve()}", file=sys.stderr)

	DataCollector(args).run()
	ReportGenerator(args).run()
	ReportNotifier(args).run()

	print(f"\n{'='*50}", file=sys.stderr)
	print(f"✅ 完了！生成ファイル:", file=sys.stderr)
	for f in sorted(OUTPUT_DIR.iterdir()):
		size = f.stat().st_size
		print(f"  {f.name:35s} ({size:>8,} bytes)", file=sys.stderr)


if __name__ == "__main__":
	main()

