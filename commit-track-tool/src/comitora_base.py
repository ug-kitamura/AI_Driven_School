"""
comitora_base.py - Comitora 基底クラス

共通の初期化・ユーティリティ・CLI引数定義を提供する。
DataCollector / ReportGenerator / ReportNotifier はこのクラスを継承する。
"""

import sys
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone

try:
	load_dotenv()
except ImportError:
	load_dotenv(Path(__file__).parent.parent / ".env")

OUTPUT_DIR  = Path("../output")


class ComitoraBase(ABC):
	"""Comitora 処理クラスの基底クラス。"""

	DEBUG       = False
	REPORT_DATA = {}
	TIMEZONE    = timezone(timedelta(hours=9)) #Japan
	NOW_LOCAL   = datetime.now(TIMEZONE)

	def __init__(self, args: argparse.Namespace) -> None:
		self.args = args
		self.OUTPUT_DIR = OUTPUT_DIR
		self.OUTPUT_DIR.mkdir(exist_ok=True)

	# ------------------------------------------------------------------
	# 共通 CLI 引数
	# ------------------------------------------------------------------

	@classmethod
	def add_common_args(cls, parser: argparse.ArgumentParser) -> None:
		"""全クラス共通の引数をパーサーに追加する。"""
		parser.add_argument("--owner", required=True, help="GitHubオーナー名")
		parser.add_argument("--repo",  required=True, help="リポジトリ名")
		parser.add_argument("--days",        type=int, default=7,  help="直近何日分（デフォルト: 7）")
		parser.add_argument("--active-days", type=int, default=30, help="アクティブ判定日数（デフォルト: 30）")

	@classmethod
	def add_args(cls, parser: argparse.ArgumentParser) -> None:
		"""サブクラス固有の引数を追加する。デフォルトは何もしない。"""

	@classmethod
	def build_parser(cls, description: str = "") -> argparse.ArgumentParser:
		"""単体実行用パーサーを生成する（共通引数 + クラス固有引数）。"""
		parser = argparse.ArgumentParser(
			description=description,
			formatter_class=argparse.RawDescriptionHelpFormatter,
		)
		cls.add_common_args(parser)
		cls.add_args(parser)
		return parser

	# ------------------------------------------------------------------
	# ユーティリティ
	# ------------------------------------------------------------------

	def save_json(self, filename: str, data: dict | list) -> Path:
		"""../output/ 以下に JSON を保存してパスを返す。"""
		path = self.OUTPUT_DIR / filename
		path.parent.mkdir(parents=True, exist_ok=True)
		with open(path, "w", encoding="utf-8") as f:
			json.dump(data, f, ensure_ascii=False, indent=2)
		print(f"💾 {path}", file=sys.stderr)
		return path

	def load_json(self, filename: str) -> dict:
		"""../output/ 以下の JSON を読み込む。"""
		path = self.OUTPUT_DIR / filename
		if not path.exists():
			print(f"❌ ファイルが見つかりません: {path}", file=sys.stderr)
			print(f"   前のステップが完了していない可能性があります。", file=sys.stderr)
			sys.exit(1)
		with open(path, encoding="utf-8") as f:
			return json.load(f)

	@staticmethod
	def load_text(path: Path) -> str:
		"""テキストファイルを読み込む。"""
		with open(path, encoding="utf-8") as f:
			return f.read()

	def print_section(self, label: str) -> None:
		"""セクションヘッダーを出力する。"""
		print(f"\n{'─' * 50}", file=sys.stderr)
		print(f"{label}", file=sys.stderr)
		print(f"{'─' * 50}", file=sys.stderr)

	def parse_date_range(self, days: int) -> tuple[datetime, datetime, str]:
		"""現在時刻から days 日前〜現在時刻の UTC datetime と表示ラベルを返す。"""
		end_utc   = self.NOW_LOCAL.astimezone(timezone.utc)
		start_utc = end_utc - timedelta(days=days)
		label = (
			f"直近{days}日間"
			f" ({start_utc.strftime('%Y-%m-%d')} ～ {end_utc.strftime('%Y-%m-%d')} UTC)"
		)
		return start_utc, end_utc, label


	# ------------------------------------------------------------------
	# 実行（サブクラスで実装）
	# ------------------------------------------------------------------

	@abstractmethod
	def run(self) -> None:
		"""処理を実行する。サブクラスで実装すること。"""

