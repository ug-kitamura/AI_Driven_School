"""
comitora_report_generator.py - Claude によるレポート生成・評価クラス

処理内容:
	- aggregated_data.json を読み込み Claude でHTMLレポートを生成
	- 生成HTMLをバリデーション
	- 別の Claude 呼び出しでレポート品質を評価

入力ファイル:
	../output/report_data.json  DataCollector が生成した集計データ

出力ファイル:
	../output/weekly_report.html    生成されたレポートHTML
	../output/validation_result.json バリデーション結果
	../output/evaluation_result.json 品質評価結果

単体実行（DataCollector の後に実行すること）:
	python comitora_report_generator.py --owner your-org --repo your-repo
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from html.parser import HTMLParser
from comitora_base import ComitoraBase

SKILL_PATH    = Path("../.claude/skills/commit-track/SKILL.md")
TEMPLATE_PATH = Path("../template/weekly-report.html")


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

		# Step 4: レポート生成
		self.print_section("Claude でレポートを生成中")
		html = self._generate(aggregated)
		html_path = self.output_dir / "weekly_report.html"
		html_path.write_text(html, encoding="utf-8")
		print(f"  💾 {html_path} ({len(html):,} 文字)", file=sys.stderr)

		# Step 5: バリデーション
		self.print_section("HTML をバリデーション中")
		validation = self._validate(html)
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
		evaluation = self._evaluate(html, aggregated)
		self.save_json("evaluation_result.json", evaluation)

		if evaluation.get("parsed", {}).get("score"):
			print(f"  品質スコア: {evaluation['parsed']['score']}/5", file=sys.stderr)
			for imp in evaluation.get("parsed", {}).get("improvements", []):
				print(f"  💡 {imp}", file=sys.stderr)

	# ------------------------------------------------------------------
	# Step 4: Claude レポート生成
	# ------------------------------------------------------------------

	def _generate(self, aggregated: dict) -> str:
		"""
		Anthropic SDK で Claude を呼び出し、週次レポートHTMLを生成する。
		SKILL.md とテンプレートHTMLをシステムプロンプトに置いて Prompt Caching を利用する。
		"""
		anthropic = self._import_anthropic()
		api_key   = self._resolve_anthropic_key()

		for path, label in [(SKILL_PATH, "SKILL.md"), (TEMPLATE_PATH, "テンプレートHTML")]:
			if not path.exists():
				print(f"❌ {label} が見つかりません: {path}", file=sys.stderr)
				sys.exit(1)

		skill_content    = self.load_text(SKILL_PATH)
		template_content = self.load_text(TEMPLATE_PATH)

		system_content = (
			f"{skill_content}\n\n"
			f"## テンプレートHTML\n\n"
			f"以下のHTMLテンプレートのプレースホルダーをデータで埋めてください。\n\n"
			f"```html\n{template_content}\n```"
		)

		commits_for_claude = aggregated["commits"][:200]
		data_for_claude    = {**aggregated, "commits": commits_for_claude}
		user_content = (
			"以下のデータを使用して週次レポートHTMLを生成してください。\n\n"
			f"```json\n{json.dumps(data_for_claude, ensure_ascii=False, indent=2)}\n```"
		)

		client   = anthropic.Anthropic(api_key=api_key)
		response = client.messages.create(
			model="claude-sonnet-4-5",
			max_tokens=16000,
			system=[
				{
					"type": "text",
					"text": system_content,
					"cache_control": {"type": "ephemeral"},
				}
			],
			messages=[{"role": "user", "content": user_content}],
		)

		usage = response.usage
		print(f"  トークン: input={usage.input_tokens}, output={usage.output_tokens}", file=sys.stderr)
		if hasattr(usage, "cache_read_input_tokens"):
			print(f"  キャッシュヒット: {usage.cache_read_input_tokens} tokens", file=sys.stderr)

		return response.content[0].text

	# ------------------------------------------------------------------
	# Step 5: HTML バリデーション
	# ------------------------------------------------------------------

	def _validate(self, html: str) -> dict:
		"""
		生成された HTML を検証する。
		- 未置換プレースホルダー（{{ }} 形式）の残存チェック
		- 必須セクションIDの存在チェック
		- HTML 構文の基本チェック
		"""
		issues:   list[str] = []
		warnings: list[str] = []

		remaining = re.findall(r"\{\{[^}]+\}\}", html)
		if remaining:
			issues.append(f"未置換プレースホルダーが残っています: {list(set(remaining))}")

		for section_id in ["header", "stats", "action-plan", "hero", "team-message"]:
			if f'id="{section_id}"' not in html and f"id='{section_id}'" not in html:
				warnings.append(f"セクション id='{section_id}' が見つかりません（テンプレート次第で正常）")

		if "<html" not in html.lower():
			issues.append("HTMLタグがありません")
		if "</body>" not in html.lower():
			issues.append("</body>タグがありません")

		try:
			HTMLParser().feed(html)
		except Exception as e:
			issues.append(f"HTMLパースエラー: {e}")

		return {
			"passed":      len(issues) == 0,
			"issues":      issues,
			"warnings":    warnings,
			"html_length": len(html),
			"validated_at": self.now_jst().isoformat(),
		}

	# ------------------------------------------------------------------
	# Step 6: 品質評価
	# ------------------------------------------------------------------

	def _evaluate(self, html: str, aggregated: dict) -> dict:
		"""別の Claude 呼び出しでレポートの品質を評価する。"""
		try:
			anthropic = self._import_anthropic()
		except SystemExit:
			return {"skipped": True, "reason": "anthropic ライブラリ未インストール"}

		try:
			api_key = self._resolve_anthropic_key()
		except SystemExit:
			return {"skipped": True, "reason": "APIキー未設定"}

		stats     = aggregated.get("stats", {})
		hero_name = aggregated.get("hero", {}).get("login", "不明") if aggregated.get("hero") else "なし"
		html_excerpt = html[:10000]

		prompt = f"""あなたは開発チームの週次レポートの品質レビュアーです。
以下のレポートHTMLを評価し、結果をJSONで返してください。

## 評価観点
1. アクションプランはコミット・PRデータに基づいた具体的な内容か
2. チームメッセージ・ヒーローコメントは自然な日本語か
3. Tipsはプロジェクト文脈と関連しているか
4. 全体的な読みやすさと有用性

## 参考データ
- コミット数: {stats.get('commits', 0)}
- マージ済みPR: {stats.get('merged_prs', 0)}
- クローズしたIssue: {stats.get('closed_issues', 0)}
- 今週のヒーロー: {hero_name}

## レポートHTML（抜粋）
{html_excerpt}

## 出力形式（JSON のみ、説明文不要）
{{
	"score": 1〜5の整数,
	"action_plan_quality": "コメント",
	"message_quality": "コメント",
	"tips_quality": "コメント",
	"improvements": ["改善点1", "改善点2"]
}}"""

		client   = anthropic.Anthropic(api_key=api_key)
		response = client.messages.create(
			model="claude-sonnet-4-5",
			max_tokens=1024,
			messages=[{"role": "user", "content": prompt}],
		)

		raw_text    = response.content[0].text
		evaluated_at = self.now_jst().isoformat()

		try:
			json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
			parsed     = json.loads(json_match.group()) if json_match else {}
		except (json.JSONDecodeError, AttributeError):
			parsed = {}

		return {
			"evaluated_at": evaluated_at,
			"parsed":       parsed,
			"raw_response": raw_text,
		}

	# ------------------------------------------------------------------
	# 内部ヘルパー
	# ------------------------------------------------------------------

	def _import_anthropic(self):
		try:
			import anthropic
			return anthropic
		except ImportError:
			print("❌ anthropic ライブラリが未インストールです。`pip install anthropic` を実行してください。", file=sys.stderr)
			sys.exit(1)

	def _resolve_anthropic_key(self) -> str:
		key = getattr(self.args, "anthropic_key", None) or os.environ.get("ANTHROPIC_API_KEY")
		if not key:
			print("❌ --anthropic-key または環境変数 ANTHROPIC_API_KEY でAPIキーを指定してください", file=sys.stderr)
			sys.exit(1)
		return key


# ------------------------------------------------------------------
# 単体実行（DataCollector 実行後に ../output/aggregated_data.json が必要）
# ------------------------------------------------------------------

if __name__ == "__main__":
	parser = ReportGenerator.build_parser(
		"../output/report_data.json を読み込み Claude でレポートを生成・評価する"
	)
	ReportGenerator(parser.parse_args()).run()

