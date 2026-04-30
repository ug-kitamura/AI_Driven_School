#!/usr/bin/env python3
"""
main.py - Comitora 週次レポート生成のオーケストレータ

処理フロー:
	[Step 1] GitHubClient.fetch_commits()     → output/commits.json
	[Step 2] GitHubClient.fetch_report_data() → output/report_data.json
	[Step 3] データ集計                          → output/aggregated_data.json
	[Step 4] Claude レポート生成                 → output/weekly_report.html
	[Step 5] HTML バリデーション                  → output/validation_result.json
	[Step 6] サブエージェント評価                  → output/evaluation_result.json

使い方:
	python main.py --owner your-org --repo your-repo

オプション:
	--owner         GitHubオーナー名（必須）
	--repo          リポジトリ名（必須）
	--days          直近何日分を対象とするか（デフォルト: 7）
	--concurrency   get_commits.py のファイル取得並列数（デフォルト: 5）
	--no-gitignore  .gitignoreによるファイルフィルタを無効化
	--token         GitHub APIトークン（省略時は環境変数 GH_TOKEN を使用）
	--anthropic-key Anthropic APIキー（省略時は環境変数 ANTHROPIC_API_KEY を使用）
	--skip-claude   Claude API の呼び出しをスキップ（データ取得のみ確認したい場合）

環境変数:
	GH_TOKEN            GitHub APIトークン（--token 未指定時のフォールバック）
	ANTHROPIC_API_KEY   Anthropic APIキー（--anthropic-key 未指定時のフォールバック）
"""

import argparse
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

try:
	from dotenv import load_dotenv
	load_dotenv()
except ImportError:
	pass

from github_client import GitHubClient, JST

OUTPUT_DIR = Path("output")
SKILL_PATH = Path("skills/report-generator/SKILL.md")
TEMPLATE_PATH = Path("templates/weekly-report.html")


# ---------------------------------------------------------------------------
# CLI 引数
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Comitora 週次レポートを生成する",
		formatter_class=argparse.RawDescriptionHelpFormatter,
	)
	parser.add_argument("--owner", required=True, help="GitHubオーナー名")
	parser.add_argument("--repo", required=True, help="リポジトリ名")
	parser.add_argument("--days",        type=int, default=7,  help="直近何日分を対象とするか（デフォルト: 7）")
	parser.add_argument("--active-days", type=int, default=30, help="アクティブブランチ判定日数（デフォルト: 30）")
	parser.add_argument("--concurrency", type=int, default=5,  help="ファイル取得並列数（デフォルト: 5）")
	parser.add_argument("--no-gitignore", action="store_true", help=".gitignoreフィルタを無効化")
	parser.add_argument(
		"--token",
		default=None,
		help="GitHub APIトークン（省略時は環境変数 GH_TOKEN を使用）",
	)
	parser.add_argument(
		"--anthropic-key",
		dest="anthropic_key",
		default=None,
		help="Anthropic APIキー（省略時は環境変数 ANTHROPIC_API_KEY を使用）",
	)
	parser.add_argument("--skip-claude", action="store_true", help="Claude APIをスキップ（データ取得の確認のみ）")
	return parser.parse_args()


# ---------------------------------------------------------------------------
# ユーティリティ
# ---------------------------------------------------------------------------

def save_json(path: Path, data: dict | list) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	with open(path, "w", encoding="utf-8") as f:
		json.dump(data, f, ensure_ascii=False, indent=2)
	print(f"  💾 {path}", file=sys.stderr)


def load_json(path: Path) -> dict:
	with open(path, encoding="utf-8") as f:
		return json.load(f)


def load_text(path: Path) -> str:
	with open(path, encoding="utf-8") as f:
		return f.read()


def print_step(n: int, label: str) -> None:
	print(f"\n{'='*50}", file=sys.stderr)
	print(f"[Step {n}] {label}", file=sys.stderr)
	print(f"{'='*50}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Step 1 & 2: GitHub データ取得（GitHubClient を直接使用）
# ---------------------------------------------------------------------------

def fetch_github_data(args: argparse.Namespace, client: GitHubClient) -> tuple[dict, dict]:
	"""コミットデータと PR/Issue/Milestone データを取得して output/ に保存する。"""
	print_step(1, "コミットデータを取得中")
	commits_data = client.fetch_commits(
		days=args.days,
		active_days=args.active_days,
		concurrency=args.concurrency,
		use_gitignore=not args.no_gitignore,
	)
	save_json(OUTPUT_DIR / "commits.json", commits_data)

	print_step(2, "PR・Issue・Milestone データを取得中")
	report_data = client.fetch_report_data(days=args.days)
	save_json(OUTPUT_DIR / "report_data.json", report_data)

	return commits_data, report_data


# ---------------------------------------------------------------------------
# Step 3: データ集計
# ---------------------------------------------------------------------------

def aggregate_data(commits_data: dict, report_data: dict) -> dict:
	"""
	commits.json と report_data.json を統合し、Claude に渡す集計データを生成する。

	- コミット数・ユニークファイル数を人ごとに集計
	- 貢献スコア = コミット数×1 + マージPR数×3 + レビュー数×2
	- スコア順にランク付けし、1位をヒーローとして設定
	- 進捗度 = マージ済みPR / (マージ済みPR + オープンPR) × 100
	"""
	# コミットを人ごとに集計
	commit_count_by_author: dict[str, int] = {}
	unique_files: set[str] = set()

	for commit in commits_data.get("commits", []):
		login = commit["author"]["login"]
		commit_count_by_author[login] = commit_count_by_author.get(login, 0) + 1
		for f in commit.get("files", []):
			unique_files.add(f["path"])

	# avatar_url を commits から補完するためのマップ
	avatar_map: dict[str, str] = {}
	for commit in commits_data.get("commits", []):
		login = commit["author"]["login"]
		if login not in avatar_map:
			avatar_map[login] = commit["author"].get("avatar_url", "")

	# contributor_activity にコミット数を追加してスコア計算
	contributor_activity: dict[str, dict] = {}
	for login, data in report_data.get("contributor_activity", {}).items():
		contributor_activity[login] = dict(data)

	# コミットのみで存在するメンバーを追加
	for login, count in commit_count_by_author.items():
		if login not in contributor_activity:
			contributor_activity[login] = {
				"login": login,
				"avatar_url": avatar_map.get(login, ""),
				"prs_created": 0,
				"prs_merged": 0,
				"reviews_submitted": 0,
			}

	# コミット数 & スコアをセット
	for login, data in contributor_activity.items():
		data["commits"] = commit_count_by_author.get(login, 0)
		data["score"] = (
			data["commits"] * 1
			+ data.get("prs_merged", 0) * 3
			+ data.get("reviews_submitted", 0) * 2
		)

	# スコア順にランク付け
	contributors_ranked = sorted(
		contributor_activity.values(),
		key=lambda x: x["score"],
		reverse=True,
	)
	for i, c in enumerate(contributors_ranked, 1):
		c["rank"] = i

	hero = contributors_ranked[0] if contributors_ranked else None

	# 進捗度
	summary = report_data["prs"]["summary"]
	merged_count = summary["merged_count"]
	open_count = summary["open_count"]
	total_prs = merged_count + open_count
	progress_pct = round(merged_count / total_prs * 100) if total_prs > 0 else 0

	return {
		"metadata": {
			"period": commits_data["metadata"]["period"],
			"days": commits_data["metadata"]["days"],
			"start_utc": commits_data["metadata"]["start_utc"],
			"end_utc": commits_data["metadata"]["end_utc"],
			"repository": commits_data["metadata"]["repository"],
			"generated_at": datetime.now(JST).isoformat(),
		},
		"progress": {
			"progress_pct": progress_pct,
			"merged_prs": merged_count,
			"open_prs": open_count,
		},
		"stats": {
			"merged_prs": merged_count,
			"open_prs": open_count,
			"awaiting_review": summary["awaiting_review_count"],
			"feedback_in_progress": summary["feedback_in_progress_count"],
			"approved": summary["approved_count"],
			"draft": summary["draft_count"],
			"closed_issues": report_data["issues"]["closed_count"],
			"commits": commits_data["metadata"]["total_commits"],
			"unique_files_changed": len(unique_files),
		},
		"prs": report_data["prs"],
		"issues": report_data["issues"],
		"milestones": report_data["milestones"],
		"contributors_ranked": contributors_ranked,
		"hero": hero,
		# コミット一覧はClaudeのアクションプラン・チームメッセージ生成に使用
		"commits": commits_data.get("commits", []),
	}


# ---------------------------------------------------------------------------
# Step 4: Claude でレポート生成
# ---------------------------------------------------------------------------

def generate_report_with_claude(aggregated: dict, anthropic_key: str | None = None) -> str:
	"""
	Anthropic SDK で Claude を呼び出し、週次レポートHTMLを生成する。
	SKILL.md とテンプレートHTMLをシステムプロンプトに配置して Prompt Caching を利用する。
	"""
	try:
		import anthropic
	except ImportError:
		print("❌ anthropic ライブラリが未インストールです。`pip install anthropic` を実行してください。", file=sys.stderr)
		sys.exit(1)

	api_key = anthropic_key or os.environ.get("ANTHROPIC_API_KEY")
	if not api_key:
		print("❌ --anthropic-key または環境変数 ANTHROPIC_API_KEY でAPIキーを指定してください", file=sys.stderr)
		sys.exit(1)

	if not SKILL_PATH.exists():
		print(f"❌ スキルファイルが見つかりません: {SKILL_PATH}", file=sys.stderr)
		print("   Step 2（SKILL.md の作成）が完了していない可能性があります。", file=sys.stderr)
		sys.exit(1)

	if not TEMPLATE_PATH.exists():
		print(f"❌ テンプレートファイルが見つかりません: {TEMPLATE_PATH}", file=sys.stderr)
		print("   Step 2（weekly-report.html テンプレートの作成）が完了していない可能性があります。", file=sys.stderr)
		sys.exit(1)

	skill_content = load_text(SKILL_PATH)
	template_content = load_text(TEMPLATE_PATH)

	# Prompt Caching: 固定コンテンツ（スキル + テンプレート）をシステムプロンプトに配置
	system_content = (
		f"{skill_content}\n\n"
		f"## テンプレートHTML\n\n"
		f"以下のHTMLテンプレートのプレースホルダーをデータで埋めてください。\n\n"
		f"```html\n{template_content}\n```"
	)

	# ユーザーメッセージ: 毎回変わるデータ
	# コミット一覧が長すぎる場合はコミット数上限を設ける
	commits_for_claude = aggregated["commits"][:200]  # 最大200件
	data_for_claude = {**aggregated, "commits": commits_for_claude}
	user_content = (
		"以下のデータを使用して週次レポートHTMLを生成してください。\n\n"
		f"```json\n{json.dumps(data_for_claude, ensure_ascii=False, indent=2)}\n```"
	)

	client = anthropic.Anthropic(api_key=api_key)
	response = client.messages.create(
		model="claude-sonnet-4-5",
		max_tokens=16000,
		system=[
			{
				"type": "text",
				"text": system_content,
				"cache_control": {"type": "ephemeral"},  # Prompt Caching
			}
		],
		messages=[{"role": "user", "content": user_content}],
	)

	# 使用トークン数をログ出力（Prompt Caching の効果確認用）
	usage = response.usage
	print(f"  トークン使用量: input={usage.input_tokens}, output={usage.output_tokens}", file=sys.stderr)
	if hasattr(usage, "cache_read_input_tokens"):
		print(f"  キャッシュヒット: {usage.cache_read_input_tokens} tokens", file=sys.stderr)

	return response.content[0].text


# ---------------------------------------------------------------------------
# Step 5: HTML バリデーション
# ---------------------------------------------------------------------------

def validate_html(html: str) -> dict:
	"""
	生成された HTML を検証する。
	- 未置換プレースホルダー（{{ }} 形式）の残存チェック
	- 必須セクションIDの存在チェック
	- HTML 構文の基本チェック
	"""
	issues: list[str] = []
	warnings: list[str] = []

	# 未置換プレースホルダーのチェック
	remaining = re.findall(r"\{\{[^}]+\}\}", html)
	if remaining:
		unique_remaining = list(set(remaining))
		issues.append(f"未置換プレースホルダーが残っています: {unique_remaining}")

	# 必須セクションIDのチェック（テンプレートに合わせて後で調整）
	required_ids = ["header", "stats", "action-plan", "hero", "team-message"]
	for section_id in required_ids:
		if f'id="{section_id}"' not in html and f"id='{section_id}'" not in html:
			warnings.append(f"セクション id='{section_id}' が見つかりません（テンプレート次第で正常）")

	# HTMLの基本構造チェック
	if "<html" not in html.lower():
		issues.append("HTMLタグがありません")
	if "</body>" not in html.lower():
		issues.append("</body>タグがありません")

	# 構文チェック（HTMLParser は構文エラーを例外で通知しないため try/except で捕捉）
	try:
		HTMLParser().feed(html)
	except Exception as e:
		issues.append(f"HTMLパースエラー: {e}")

	passed = len(issues) == 0
	return {
		"passed": passed,
		"issues": issues,
		"warnings": warnings,
		"html_length": len(html),
		"validated_at": datetime.now(JST).isoformat(),
	}


# ---------------------------------------------------------------------------
# Step 6: サブエージェントによる品質評価
# ---------------------------------------------------------------------------

def evaluate_report_quality(html: str, aggregated: dict, anthropic_key: str | None = None) -> dict:
	"""
	別の Claude 呼び出しでレポートの品質を評価する。
	評価結果は JSON 形式で返す。tool_use は使わず simple messages API を使用。
	"""
	try:
		import anthropic
	except ImportError:
		return {"skipped": True, "reason": "anthropic ライブラリ未インストール"}

	api_key = anthropic_key or os.environ.get("ANTHROPIC_API_KEY")
	if not api_key:
		return {"skipped": True, "reason": "APIキー未設定（--anthropic-key または ANTHROPIC_API_KEY）"}

	stats = aggregated.get("stats", {})
	hero_name = aggregated.get("hero", {}).get("login", "不明") if aggregated.get("hero") else "なし"

	# HTMLが長すぎる場合は先頭部分のみ渡す（評価には十分）
	html_excerpt = html[:10000] if len(html) > 10000 else html

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

	client = anthropic.Anthropic(api_key=api_key)
	response = client.messages.create(
		model="claude-sonnet-4-5",
		max_tokens=1024,
		messages=[{"role": "user", "content": prompt}],
	)

	raw_text = response.content[0].text
	evaluated_at = datetime.now(JST).isoformat()

	# JSONパースを試みる（失敗しても raw_text は保存する）
	try:
		json_match = re.search(r"\{.*\}", raw_text, re.DOTALL)
		parsed = json.loads(json_match.group()) if json_match else {}
	except (json.JSONDecodeError, AttributeError):
		parsed = {}

	return {
		"evaluated_at": evaluated_at,
		"parsed": parsed,
		"raw_response": raw_text,
	}


# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------

def main() -> None:
	args = parse_args()

	token = args.token or os.environ.get("GH_TOKEN")
	if not token:
		print("エラー: --token または環境変数 GH_TOKEN でトークンを指定してください", file=sys.stderr)
		sys.exit(1)

	OUTPUT_DIR.mkdir(exist_ok=True)
	print(f"📁 出力先: {OUTPUT_DIR.resolve()}", file=sys.stderr)

	client = GitHubClient(token, args.owner, args.repo)

	# Step 1 & 2: GitHub データ取得
	commits_data, report_data = fetch_github_data(args, client)
	print(f"  コミット数  : {commits_data['metadata']['total_commits']}", file=sys.stderr)
	print(f"  マージ済みPR: {report_data['prs']['summary']['merged_count']}", file=sys.stderr)
	print(f"  オープンPR  : {report_data['prs']['summary']['open_count']}", file=sys.stderr)

	# Step 3: データ集計
	print_step(3, "データを集計中")
	aggregated = aggregate_data(commits_data, report_data)
	save_json(OUTPUT_DIR / "aggregated_data.json", aggregated)

	hero = aggregated.get("hero")
	print(f"  進捗度      : {aggregated['progress']['progress_pct']}%", file=sys.stderr)
	print(f"  ユニークファイル数: {aggregated['stats']['unique_files_changed']}", file=sys.stderr)
	if hero:
		print(f"  今週のヒーロー: {hero['login']} (スコア: {hero['score']})", file=sys.stderr)

	if args.skip_claude:
		print("\n⏭️  --skip-claude が指定されたため Claude の呼び出しをスキップします", file=sys.stderr)
		print(f"\n✅ データ取得完了。output/ フォルダを確認してください。", file=sys.stderr)
		return

	# Step 4: Claude でレポート生成
	print_step(4, "Claude でレポートを生成中")
	html = generate_report_with_claude(aggregated, anthropic_key=args.anthropic_key)
	html_path = OUTPUT_DIR / "weekly_report.html"
	html_path.write_text(html, encoding="utf-8")
	print(f"  💾 {html_path} ({len(html):,} 文字)", file=sys.stderr)

	# Step 5: バリデーション
	print_step(5, "HTML をバリデーション中")
	validation = validate_html(html)
	save_json(OUTPUT_DIR / "validation_result.json", validation)

	if validation["issues"]:
		print("  ❌ バリデーション失敗:", file=sys.stderr)
		for issue in validation["issues"]:
			print(f"    - {issue}", file=sys.stderr)
		sys.exit(1)

	if validation["warnings"]:
		for w in validation["warnings"]:
			print(f"  ⚠️  {w}", file=sys.stderr)

	print(f"  ✅ バリデーション通過 ({validation['html_length']:,} 文字)", file=sys.stderr)

	# Step 6: サブエージェント品質評価
	print_step(6, "サブエージェントで品質を評価中")
	evaluation = evaluate_report_quality(html, aggregated, anthropic_key=args.anthropic_key)
	save_json(OUTPUT_DIR / "evaluation_result.json", evaluation)

	if evaluation.get("parsed", {}).get("score"):
		score = evaluation["parsed"]["score"]
		print(f"  品質スコア: {score}/5", file=sys.stderr)
		for imp in evaluation.get("parsed", {}).get("improvements", []):
			print(f"  💡 {imp}", file=sys.stderr)

	print(f"\n{'='*50}", file=sys.stderr)
	print(f"✅ 完了！生成ファイル:", file=sys.stderr)
	for f in sorted(OUTPUT_DIR.iterdir()):
		size = f.stat().st_size
		print(f"  {f.name:35s} ({size:>8,} bytes)", file=sys.stderr)


if __name__ == "__main__":
	main()
