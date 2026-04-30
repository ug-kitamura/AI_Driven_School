#!/usr/bin/env python3
"""
get_report_data.py - 週次レポート用のPR・Issue・Milestone・貢献度データを取得する CLI スクリプト

使い方:
	python get_report_data.py --owner your-org --repo your-repo

オプション:
	--owner         GitHubオーナー名（必須）
	--repo          リポジトリ名（必須）
	--days          直近何日分を対象とするか（デフォルト: 7）
	--token         GitHub APIトークン（省略時は環境変数 GH_TOKEN を使用）
	--output, -o    指定すると output/report_data.json に保存（省略時はstdout）
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
	from dotenv import load_dotenv
	load_dotenv()
except ImportError:
	pass

from github_client import GitHubClient


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="週次レポート用のPR・Issue・Milestone・貢献度データを取得する",
		formatter_class=argparse.RawDescriptionHelpFormatter,
	)
	parser.add_argument("--owner", required=True, help="GitHubオーナー名")
	parser.add_argument("--repo",  required=True, help="リポジトリ名")
	parser.add_argument("--days",        type=int, default=7,  help="直近何日分（デフォルト: 7）")
	parser.add_argument("--active-days", type=int, default=30, help="PR取得の打ち切り基準日数（デフォルト: 30）")
	parser.add_argument("--token", default=None, help="GitHub APIトークン（省略時は GH_TOKEN）")
	parser.add_argument(
		"--output", "-o",
		action="store_true",
		default=False,
		help="指定すると output/report_data.json に保存（省略時はstdout）",
	)
	return parser.parse_args()


def main() -> None:
	args = parse_args()

	token = args.token or os.environ.get("GH_TOKEN")
	if not token:
		print("エラー: --token または環境変数 GH_TOKEN でトークンを指定してください", file=sys.stderr)
		sys.exit(1)

	client = GitHubClient(token, args.owner, args.repo)
	result = client.fetch_report_data(days=args.days, active_days=args.active_days)

	json_str = json.dumps(result, ensure_ascii=False, indent=2)

	if args.output:
		output_path = Path("output") / "report_data.json"
		output_path.parent.mkdir(exist_ok=True)
		output_path.write_text(json_str, encoding="utf-8")
		print(f"\n✅ 出力完了: {output_path}", file=sys.stderr)
	else:
		print(json_str)


if __name__ == "__main__":
	main()

