"""
comitora_report_generator.py - Claude によるレポート生成クラス

処理内容（順序）:
	1. Claude で HTML レポート生成
	2. --skip-review 以外: スキルに従いレビューし `comitora-evaluate.md` に保存
	3. ロゴ PNG を base64 の data URI にし Jinja2 で埋め込み、`comitora-report.html` に保存
	4. --skip-validation 以外: 上記と同一の最終 HTML をバリデーションし `validation_result.json` に保存

入力ファイル:
	output/report_data.json  DataCollector が生成した集計データ

出力ファイル:
	output/comitora-report.html   生成されたレポートHTML
	output/comitora-evaluate.md   レビュー結果（--skip-review 時以外に生成）
	output/validation_result.json バリデーション結果（--skip-validation 時以外に生成）

単体実行（commit-track-tool/ から実行、DataCollector の後に実行すること）:
	uv run python src/comitora_report_generator.py --owner your-org --repo your-repo
	uv run python src/comitora_report_generator.py --owner ... --repo ... --skip-review
	uv run python src/comitora_report_generator.py --owner ... --repo ... --skip-validation
"""

import os
import re
import sys
import json
import base64
import argparse
from pathlib import Path
from html.parser import HTMLParser
from jinja2 import Environment, StrictUndefined
from comitora_base import ComitoraBase


# AIモデルと最大トークン
LLM_MODEL         = "claude-sonnet-4-6"
MAX_TOKENS        = 32768
MAX_TOKENS_REVIEW = 8192

# スキルの定義ファイル
SKILL_PATH = Path(".claude/skills/commit-track/SKILL.md")

# スキル同梱のテンプレート（API 呼び出し時にユーザメッセージへ埋め込む）
SKILL_BASE_HTML = Path(".claude/skills/commit-track/references/base.html")

# commit-track-tool/ をカレントにしたときのロゴ候補
COMMITORA_LOGO_CANDIDATES = (Path("assets/comitora.png"), Path("comitora.png"))

# バリデーションに使用するセクションID
REQUIRED_SECTION_IDS = ["action-plan", "hero", "team-message", "footer"]


class ReportGenerator(ComitoraBase):
	"""集計データから Claude でレポート HTML を生成し、レビューやバリデーションを実施"""

	@classmethod
	def add_args(cls, parser: argparse.ArgumentParser) -> None:
		parser.add_argument(
			"--anthropic-key",
			dest    = "anthropic_key",
			default = None,
			help    = "Anthropic APIキー（省略時は環境変数 ANTHROPIC_API_KEY）",
		)
		parser.add_argument(
			"--skip-claude",
			action = "store_true",
			help   = "Claude APIをスキップ（集計データの確認のみ）",
		)
		parser.add_argument(
			"--skip-review",
			action = "store_true",
			help   = "スキルのレビュー（comitora-evaluate.md）をスキップする",
		)
		parser.add_argument(
			"--skip-validation",
			action = "store_true",
			help   = "HTML バリデーション（validation_result.json）をスキップする",
		)

	def run(self) -> None:
		aggregated = self.load_json("report_data.json")

		if self.args.skip_claude:
			print("\n⏭️  --skip-claude が指定されたため Claude の呼び出しをスキップします", file=sys.stderr)
			return

		system_content = self._build_system_content()

		# レポート生成
		self.print_section("Claude でレポートを生成中")
		html = self._generate(aggregated, system_content)

		# レポートレビュー
		if not self.args.skip_review:
			self.print_section("レポートをレビュー中（comitora-evaluate.md）")
			self._review_report(html, aggregated, system_content)

		# ロゴ画像埋め込み
		self.print_section("ロゴ画像をレポートに埋め込み")
		html = self._inject_comitora_logo(html)

		# HTML バリデーション
		if not self.args.skip_validation:
			self.print_section("HTML をバリデーション中")
			self._validate(html, aggregated)

		# レポート保存
		self.REPORT_PATH.write_text(html, encoding="utf-8")
		print(f"💾 {self.REPORT_PATH} ({len(html):,} 文字)", file=sys.stderr)

	# ------------------------------------------------------------------
	# システムプロンプト構築（生成で Prompt Caching 再利用）
	# ------------------------------------------------------------------

	def _build_system_content(self) -> str:
		"""commit-track スキル全文をシステムプロンプトとする（Prompt Caching 再利用）。"""
		if not SKILL_PATH.exists():
			print(f"❌ SKILL.md が見つかりません: {SKILL_PATH}", file=sys.stderr)
			sys.exit(1)
		return self.load_text(SKILL_PATH)

	# ------------------------------------------------------------------
	# レポート生成
	# ------------------------------------------------------------------

	def _generate(self, aggregated: dict, system_content: str) -> str:
		"""
		Anthropic SDK で Claude を呼び出し、レポートHTMLを生成する。
		システムプロンプト（commit-track SKILL.md のみ）を Prompt Caching でキャッシュする。
		"""
		anthropic = self._import_anthropic()
		api_key   = self._resolve_anthropic_key()

		if not SKILL_BASE_HTML.exists():
			print(f"❌ スキル同梱の base.html が見つかりません: {SKILL_BASE_HTML}", file=sys.stderr)
			sys.exit(1)
		base_content = self.load_text(SKILL_BASE_HTML)

		commits_for_claude = aggregated["commit"][:200]
		data_for_claude    = {**aggregated, "commit": commits_for_claude}

		user_content = (
			"システムプロンプトの commit-track スキルに従い、次のテンプレートと集計データからレポート HTML を生成してください。\n"
			"プレースホルダーをすべて置換した完全な HTML のみを出力してください（説明文や ``` フェンスは不要）。\n"
			"ただし `{{ comitora_logo_data_uri }}` は **一切変更せず**、テンプレートと同じ文字列のまま出力に含めること（URL・相対パス・別の img に置換しない）。\n\n"
			f"## テンプレート（スキル同梱 references/base.html）\n\n"
			f"```html\n{base_content}\n```\n\n"
			f"## 集計データ（report_data.json）\n\n"
			f"```json\n{json.dumps(data_for_claude, ensure_ascii=False, indent=2)}\n```"
		)

		client = anthropic.Anthropic(api_key=api_key)
		with client.messages.stream(
			model      = LLM_MODEL,
			max_tokens = MAX_TOKENS,
			system     = [
				{
					"type"         : "text",
					"text"         : system_content,
					"cache_control": {"type": "ephemeral"},
				}
			],
			messages=[{"role": "user", "content": user_content}],
		) as stream:
			text     = stream.get_final_text()
			response = stream.get_final_message()

		self._print_usage(response.usage, "生成")
		if not text:
			print("❌ Claude からテキストレスポンスが得られませんでした", file=sys.stderr)
			sys.exit(1)

		# Claude が ```html ... ``` で囲んで返すケースを除去
		text = re.sub(r"^```html\s*\n", "", text.strip())
		text = re.sub(r"\n```\s*$", "", text)
		return text

	# ------------------------------------------------------------------
	# レポートレビュー
	# ------------------------------------------------------------------

	def _review_report(self, html: str, aggregated: dict, system_content: str) -> None:
		"""SKILL.md のレビュー指示に従いマークダウンを生成し保存する。"""
		anthropic = self._import_anthropic()
		api_key   = self._resolve_anthropic_key()

		stats     = aggregated.get("pr", {}).get("summary", {})
		hero      = aggregated.get("aggregate", {}).get("hero")
		hero_name = hero.get("login", "不明") if hero else "なし"

		user_content = (
			"システムプロンプト内の **レビュー指示** に厳密に従ってください。\n"
			"次の2つの視点（プロジェクトマネジメント専門・UI/UX専門）を **1本のマークダウンドキュメント** にまとめてください。\n"
			"各観点を1〜5点で採点し、合計50点満点のサマリーを出してください。改善案も記載してください。\n"
			"出力は **マークダウンのみ**（先頭の説明文や ``` での囲みは不要）。\n\n"
			f"## 参考（report_data.json 要約）\n"
			f"- コミット数: {len(aggregated.get('commit', []))}\n"
			f"- マージ済みPR: {stats.get('merged_count', 0)}\n"
			f"- フィードバック対応中PR: {stats.get('feedback_in_progress_count', 0)}\n"
			f"- クローズしたIssue: {aggregated.get('issue', {}).get('closed_count', 0)}\n"
			f"- 対象期間のヒーロー: {hero_name}\n\n"
			f"## レビュー対象 HTML（ヘッダーロゴはプレースホルダ `{{{{ comitora_logo_data_uri }}}}` のまま）\n\n"
			f"{html}"
		)

		client = anthropic.Anthropic(api_key=api_key)
		with client.messages.stream(
			model      = LLM_MODEL,
			max_tokens = MAX_TOKENS_REVIEW,
			system     = [
				{
					"type"         : "text",
					"text"         : system_content,
					"cache_control": {"type": "ephemeral"},
				}
			],
			messages=[{"role": "user", "content": user_content}],
		) as stream:
			text     = stream.get_final_text()
			response = stream.get_final_message()

		self._print_usage(response.usage, "レビュー")

		text = text or ""
		if not text.strip():
			print("❌ レビュー結果が空です", file=sys.stderr)
			sys.exit(1)

		text = re.sub(r"^```markdown\s*\n", "", text.strip())
		text = re.sub(r"^```\s*\n", "", text)
		text = re.sub(r"\n```\s*$", "", text)

		out_path = self.OUTPUT_DIR / "comitora-evaluate.md"
		out_path.write_text(text, encoding="utf-8")
		print(f"💾 {out_path} ({len(text):,} 文字)", file=sys.stderr)

	# ------------------------------------------------------------------
	# ロゴ画像埋め込み
	# ------------------------------------------------------------------

	@staticmethod
	def _png_or_jpeg_data_uri(image_path: Path) -> str:
		"""画像ファイルを data URI に変換する。"""
		suffix = image_path.suffix.lower()
		mime_type = "image/png" if suffix == ".png" else "image/jpeg"
		with open(image_path, "rb") as f:
			encoded = base64.b64encode(f.read()).decode("utf-8")
		return f"data:{mime_type};base64,{encoded}"

	def _resolve_comitora_logo_path(self) -> Path:
		for candidate in COMMITORA_LOGO_CANDIDATES:
			if candidate.is_file():
				return candidate.resolve()
		searched = ", ".join(str(p) for p in COMMITORA_LOGO_CANDIDATES)
		print(f"❌ Comitora ロゴが見つかりません（次を確認: {searched}）", file=sys.stderr)
		sys.exit(1)

	def _inject_comitora_logo(self, html: str) -> str:
		"""`{{ comitora_logo_data_uri }}` を Jinja2 で data URI に置換する。"""
		logo_path = self._resolve_comitora_logo_path()
		uri = self._png_or_jpeg_data_uri(logo_path)
		env = Environment(undefined=StrictUndefined, autoescape=False)
		try:
			out = env.from_string(html).render(comitora_logo_data_uri=uri)
		except Exception as e:
			print(f"❌ Jinja2 レンダリング失敗（`{{{{ comitora_logo_data_uri }}}}` が Claude 出力に残っているか確認）: {e}", file=sys.stderr)
			sys.exit(1)
		print(f"🖼️ ロゴ埋め込み: {logo_path.name} → data URI ({len(uri):,} 文字)", file=sys.stderr)
		return out

	# ------------------------------------------------------------------
	# HTML バリデーション
	# ------------------------------------------------------------------

	def _validate(self, html: str, aggregated: dict) -> None:
		"""
		生成された HTML を検証する。
		- 必須セクションIDの存在チェック
		- HTML 構文の基本チェック
		- 主要数値の転記チェック（数値ミス検出）
		"""
		issues:   list[str] = []
		warnings: list[str] = []

		for section_id in REQUIRED_SECTION_IDS:
			if f'id="{section_id}"' not in html and f"id='{section_id}'" not in html:
				warnings.append(f"セクション id='{section_id}' が見つかりません")

		if "<html" not in html.lower():
			issues.append("HTMLタグがありません")
		if "</body>" not in html.lower():
			issues.append("</body>タグがありません")

		try:
			HTMLParser().feed(html)
		except Exception as e:
			issues.append(f"HTMLパースエラー: {e}")

		pr_summary   = aggregated.get("pr", {}).get("summary", {})
		merged_count = pr_summary.get("merged_count")
		if merged_count is not None and str(merged_count) not in html:
			warnings.append(f"マージPR数 ({merged_count}) が HTML に見つかりません（転記ミスの可能性）")

		hero = aggregated.get("aggregate", {}).get("hero")
		if hero and hero.get("login") and hero["login"] not in html:
			warnings.append(f"ヒーローのログイン名 ({hero['login']}) が HTML に見つかりません")

		validation = {
			"passed"      : len(issues) == 0,
			"issues"      : issues,
			"warnings"    : warnings,
			"html_length" : len(html),
			"validated_at": self.NOW_LOCAL.isoformat(),
		}

		self.save_json("validation_result.json", validation)

		if validation["issues"]:
			print("❌ バリデーション失敗:", file=sys.stderr)
			for issue in validation["issues"]:
				print(f" |- {issue}", file=sys.stderr)
			sys.exit(1)

		for w in validation.get("warnings", []):
			print(f"⚠️ {w}", file=sys.stderr)
		print(f"✅ バリデーション通過 ({validation['html_length']:,} 文字)", file=sys.stderr)

	# ------------------------------------------------------------------
	# 内部ヘルパー
	# ------------------------------------------------------------------

	@staticmethod
	def _print_usage(usage, label: str) -> None:
		"""トークン使用量をログ出力する。"""
		print(f"[{label}] トークン: input={usage.input_tokens}, output={usage.output_tokens}", file=sys.stderr)
		cache_read    = getattr(usage, "cache_read_input_tokens",    0) or 0
		cache_created = getattr(usage, "cache_creation_input_tokens", 0) or 0
		if cache_read:
			print(f"[{label}] キャッシュヒット: {cache_read:,} tokens", file=sys.stderr)
		if cache_created:
			print(f"[{label}] キャッシュ作成: {cache_created:,} tokens", file=sys.stderr)

	def _import_anthropic(self):
		try:
			import anthropic
			return anthropic
		except ImportError:
			print("❌ anthropic ライブラリが未インストールです。`uv add anthropic` を実行してください。", file=sys.stderr)
			sys.exit(1)

	def _resolve_anthropic_key(self) -> str:
		key = getattr(self.args, "anthropic_key", None) or os.environ.get("ANTHROPIC_API_KEY")
		if not key:
			print("❌ --anthropic-key または環境変数 ANTHROPIC_API_KEY でAPIキーを指定してください", file=sys.stderr)
			sys.exit(1)
		return key


# ------------------------------------------------------------------
# 単体実行（DataCollector 実行後に output/report_data.json が必要）
# ------------------------------------------------------------------

if __name__ == "__main__":
	parser = ReportGenerator.build_parser(
		"../output/report_data.json を読み込み Claude でレポートを生成する"
	)
	ReportGenerator(parser.parse_args()).run()
