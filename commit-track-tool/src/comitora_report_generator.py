"""
comitora_report_generator.py - Claude によるレポート生成・評価クラス

処理内容:
	- report_data.json を読み込み Claude でHTMLレポートを生成
	- 生成HTMLをバリデーション
	- 同じシステムプロンプト（Prompt Caching 再利用）でレポート品質を評価

入力ファイル:
	output/report_data.json  DataCollector が生成した集計データ

出力ファイル:
	output/comitora-report.html   生成されたレポートHTML
	output/validation_result.json バリデーション結果
	output/evaluation_result.json 品質評価結果

単体実行（commit-track-tool/ から実行、DataCollector の後に実行すること）:
	python src/comitora_report_generator.py --owner your-org --repo your-repo
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from html.parser import HTMLParser
from comitora_base import ComitoraBase

SKILL_PATH        = Path(".claude/skills/commit-track/SKILL.md")
BASE_PATH         = Path("template/base.html")
MODEL_ANSWER_PATH = Path("template/model-answer.html")

REQUIRED_SECTION_IDS = ["action-plan", "hero", "team-message", "footer"]


class ReportGenerator(ComitoraBase):
	"""集計データから Claude でレポートを生成し品質を検証する。"""

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

	def run(self) -> None:
		aggregated = self.load_json("report_data.json")

		if self.args.skip_claude:
			print("\n⏭️  --skip-claude が指定されたため Claude の呼び出しをスキップします", file=sys.stderr)
			return

		system_content = self._build_system_content()

		# Step 4: レポート生成
		self.print_section("Claude でレポートを生成中")
		html = self._generate(aggregated, system_content)
		html_path = self.OUTPUT_DIR / "comitora-report.html"
		html_path.write_text(html, encoding="utf-8")
		print(f"  💾 {html_path} ({len(html):,} 文字)", file=sys.stderr)

		# Step 5: バリデーション
		self.print_section("HTML をバリデーション中")
		validation = self._validate(html, aggregated)
		self.save_json("validation_result.json", validation)

		if validation["issues"]:
			print("  ❌ バリデーション失敗:", file=sys.stderr)
			for issue in validation["issues"]:
				print(f"    - {issue}", file=sys.stderr)
			sys.exit(1)

		for w in validation.get("warnings", []):
			print(f"  ⚠️  {w}", file=sys.stderr)
		print(f"  ✅ バリデーション通過 ({validation['html_length']:,} 文字)", file=sys.stderr)

		# Step 6: 品質評価
		self.print_section("サブエージェントで品質を評価中")
		evaluation = self._evaluate(html, aggregated, system_content)
		self.save_json("evaluation_result.json", evaluation)

		parsed = evaluation.get("parsed", {})
		if parsed.get("score"):
			print(f"  品質スコア: {parsed['score']}/5", file=sys.stderr)
			if parsed.get("data_accuracy"):
				print(f"  データ精度: {parsed['data_accuracy']}", file=sys.stderr)
			for imp in parsed.get("improvements", []):
				print(f"  💡 {imp}", file=sys.stderr)

	# ------------------------------------------------------------------
	# システムプロンプト構築（生成・評価で共有 → Prompt Caching 再利用）
	# ------------------------------------------------------------------

	def _build_system_content(self) -> str:
		"""SKILL.md + 完成例HTMLをシステムプロンプトとして構築する。"""
		for path, label in [
			(SKILL_PATH,        "SKILL.md"),
			(BASE_PATH,         "base.html"),
			(MODEL_ANSWER_PATH, "model-answer.html"),
		]:
			if not path.exists():
				print(f"❌ {label} が見つかりません: {path}", file=sys.stderr)
				sys.exit(1)

		skill_content        = self.load_text(SKILL_PATH)
		model_answer_content = self.load_text(MODEL_ANSWER_PATH)

		return (
			f"{skill_content}\n\n"
			f"---\n\n"
			f"## 完成例（template/model-answer.html）\n\n"
			f"以下が完成品の実例です。デザイン・文体・情報量の基準として参照してください。\n\n"
			f"```html\n{model_answer_content}\n```"
		)

	# ------------------------------------------------------------------
	# Step 4: Claude レポート生成
	# ------------------------------------------------------------------

	def _generate(self, aggregated: dict, system_content: str) -> str:
		"""
		Anthropic SDK で Claude を呼び出し、レポートHTMLを生成する。
		システムプロンプト（SKILL.md + 完成例）を Prompt Caching でキャッシュする。
		"""
		anthropic = self._import_anthropic()
		api_key   = self._resolve_anthropic_key()

		base_content = self.load_text(BASE_PATH)

		commits_for_claude = aggregated["commit"][:200]
		data_for_claude    = {**aggregated, "commit": commits_for_claude}

		user_content = (
			"以下のテンプレートと集計データをもとに、レポートHTMLを生成してください。\n"
			"テンプレートのすべての `{{ }}` プレースホルダーを埋め、完全なHTMLファイルを出力してください。\n"
			"出力はHTMLのみ。説明文やコードブロック記法（```html）は不要です。\n\n"
			f"## テンプレート（template/base.html）\n\n"
			f"```html\n{base_content}\n```\n\n"
			f"## 集計データ（report_data.json）\n\n"
			f"```json\n{json.dumps(data_for_claude, ensure_ascii=False, indent=2)}\n```"
		)

		client   = anthropic.Anthropic(api_key=api_key)
		response = client.messages.create(
			model      = "claude-sonnet-4-5",
			max_tokens = 16000,
			system     = [
				{
					"type"         : "text",
					"text"         : system_content,
					"cache_control": {"type": "ephemeral"},
				}
			],
			messages=[{"role": "user", "content": user_content}],
		)

		self._print_usage(response.usage, "生成")

		text = self._extract_text(response)
		if not text:
			print("❌ Claude からテキストレスポンスが得られませんでした", file=sys.stderr)
			sys.exit(1)

		# Claude が ```html ... ``` で囲んで返すケースを除去
		text = re.sub(r"^```html\s*\n", "", text.strip())
		text = re.sub(r"\n```\s*$", "", text)
		return text

	# ------------------------------------------------------------------
	# Step 5: HTML バリデーション
	# ------------------------------------------------------------------

	def _validate(self, html: str, aggregated: dict) -> dict:
		"""
		生成された HTML を検証する。
		- 未置換プレースホルダー（{{ }} 形式）の残存チェック
		- 必須セクションIDの存在チェック
		- HTML 構文の基本チェック
		- 主要数値の転記チェック（数値ミス検出）
		"""
		issues:   list[str] = []
		warnings: list[str] = []

		# 未置換プレースホルダー
		remaining = re.findall(r"\{\{[^}]+\}\}", html)
		if remaining:
			issues.append(f"未置換プレースホルダーが残っています: {list(set(remaining))}")

		# 必須セクションID
		for section_id in REQUIRED_SECTION_IDS:
			if f'id="{section_id}"' not in html and f"id='{section_id}'" not in html:
				warnings.append(f"セクション id='{section_id}' が見つかりません")

		# HTML 構文チェック
		if "<html" not in html.lower():
			issues.append("HTMLタグがありません")
		if "</body>" not in html.lower():
			issues.append("</body>タグがありません")

		try:
			HTMLParser().feed(html)
		except Exception as e:
			issues.append(f"HTMLパースエラー: {e}")

		# 主要数値の転記チェック
		pr_summary   = aggregated.get("pr", {}).get("summary", {})
		merged_count = pr_summary.get("merged_count")
		if merged_count is not None and str(merged_count) not in html:
			warnings.append(f"マージPR数 ({merged_count}) が HTML に見つかりません（転記ミスの可能性）")

		hero = aggregated.get("aggregate", {}).get("hero")
		if hero and hero.get("login") and hero["login"] not in html:
			warnings.append(f"ヒーローのログイン名 ({hero['login']}) が HTML に見つかりません")

		return {
			"passed"      : len(issues) == 0,
			"issues"      : issues,
			"warnings"    : warnings,
			"html_length" : len(html),
			"validated_at": self.NOW_LOCAL.isoformat(),
		}

	# ------------------------------------------------------------------
	# Step 6: 品質評価
	# ------------------------------------------------------------------

	def _evaluate(self, html: str, aggregated: dict, system_content: str) -> dict:
		"""
		同じシステムプロンプト（Prompt Caching 再利用）で品質を評価する。
		SKILL.md のレビュー指示をそのまま利用する。
		"""
		try:
			anthropic = self._import_anthropic()
			api_key   = self._resolve_anthropic_key()
		except SystemExit:
			return {"skipped": True, "reason": "anthropic 未設定"}

		stats     = aggregated.get("pr", {}).get("summary", {})
		hero      = aggregated.get("aggregate", {}).get("hero")
		hero_name = hero.get("login", "不明") if hero else "なし"

		user_content = (
			"SKILL.md のレビュー指示に従い、以下のレポートHTMLを評価してください。\n"
			"JSONのみを返してください。説明文は不要です。\n\n"
			f"## 参考データ\n"
			f"- コミット数: {len(aggregated.get('commit', []))}\n"
			f"- マージ済みPR: {stats.get('merged_count', 0)}\n"
			f"- ブロッカー: {stats.get('feedback_in_progress_count', 0)}\n"
			f"- クローズしたIssue: {aggregated.get('issue', {}).get('closed_count', 0)}\n"
			f"- 対象期間のヒーロー: {hero_name}\n\n"
			f"## レポートHTML（先頭 10,000 文字）\n\n"
			f"{html[:10000]}"
		)

		client   = anthropic.Anthropic(api_key=api_key)
		response = client.messages.create(
			model      = "claude-sonnet-4-5",
			max_tokens = 1024,
			system     = [
				{
					"type"         : "text",
					"text"         : system_content,
					"cache_control": {"type": "ephemeral"},
				}
			],
			messages=[{"role": "user", "content": user_content}],
		)

		self._print_usage(response.usage, "評価")

		raw_text     = self._extract_text(response) or ""
		evaluated_at = self.NOW_LOCAL.isoformat()

		try:
			json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
			parsed     = json.loads(json_match.group()) if json_match else {}
		except (json.JSONDecodeError, AttributeError):
			parsed = {}

		return {
			"evaluated_at": evaluated_at,
			"parsed"      : parsed,
			"raw_response": raw_text,
		}

	# ------------------------------------------------------------------
	# 内部ヘルパー
	# ------------------------------------------------------------------

	@staticmethod
	def _extract_text(response) -> str:
		"""レスポンスの content ブロックから最初の text を安全に取り出す。"""
		for block in response.content:
			if getattr(block, "type", None) == "text":
				return block.text
		return ""

	@staticmethod
	def _print_usage(usage, label: str) -> None:
		"""トークン使用量をログ出力する。"""
		print(f"  [{label}] トークン: input={usage.input_tokens}, output={usage.output_tokens}", file=sys.stderr)
		cache_read    = getattr(usage, "cache_read_input_tokens",    0) or 0
		cache_created = getattr(usage, "cache_creation_input_tokens", 0) or 0
		if cache_read:
			print(f"  [{label}] キャッシュヒット: {cache_read:,} tokens", file=sys.stderr)
		if cache_created:
			print(f"  [{label}] キャッシュ作成: {cache_created:,} tokens", file=sys.stderr)

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
		"../output/report_data.json を読み込み Claude でレポートを生成・評価する"
	)
	ReportGenerator(parser.parse_args()).run()
