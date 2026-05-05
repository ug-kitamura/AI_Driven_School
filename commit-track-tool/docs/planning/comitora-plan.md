# Comitora 開発計画

---

## 現行ツール（commit-report-tool）の概要

GitHubのコミット履歴をAIで分析し、図解レポートをSlackに自動投稿するツール。愛称「コミネコ」。

### 現行の処理フロー

```
GitHub Actions（daily-report.yml / report-job.yml）
  ↓ .claude/prompts/daily-report.md をプロンプトとして渡す
Claude Code Action（anthropics/claude-code-action@v1）
  ↓ ubuntu-latest 仮想マシン上で動作
  ├─ SKILL.md を読み込んで知識として使う
  ├─ Node.js スクリプトを Bash で実行（コミット取得・スクリーンショット）
  └─ Slack に投稿
```

### 現行の構成

| コンポーネント | パス | 役割 |
|---|---|---|
| CI 起動 | `.github/workflows/daily-report.yml` | スケジュール/手動実行 |
| 再利用ワークフロー | `.github/workflows/report-job.yml` | 環境構築・Claude Code Action 呼び出し |
| プロンプト | `.claude/prompts/daily-report.md` | Claudeへの処理手順書 |
| プロジェクト設定 | `configs/projects/*.yml` | 対象リポジトリ・アプリ・Slack設定 |
| リポジトリ設定 | `configs/repos/*.yml` | アプリ名・パス・色・アイコン |
| コミット取得 | `.claude/skills/github-api/scripts/get-all-branch-commits.js` | 全ブランチのコミットをJST日付で取得 |
| パスフィルター | `.claude/skills/github-api/scripts/filter-commits-by-path.js` | アプリパスに関係するコミットのみ抽出 |
| スクリーンショット | `.claude/skills/screenshot-capture/scripts/capture.js` | PlaywrightでHTMLをPNG化 |
| Slack投稿 | `.claude/skills/slack-formatting/scripts/post-report.js` | 画像まとめてSlack投稿 |

### スキルの仕組み

- スキル（SKILL.md）は「Claudeへの指示書・マニュアル」であり、コードではない
- Claude Code Action の `Skill` ツールが SKILL.md を読み込む
- Claude はスキルの内容を理解した上で、Bash で Node.js スクリプトを実行する
- `claude_args: "--allowedTools 'Bash,Read,Write,Edit,Glob,Grep,Skill,TodoWrite'"` で許可ツールを制限

### 現行の課題

- Claude Code Action の制約に縛られる（配信先の拡張が困難）
- 処理順序や引数がClaudeの判断に依存するため、ブレるリスクがある
- Node.js スクリプトが中心のため、Python 環境との親和性が低い


---


## 新規開発ツール（commit-track-tool）の設計方針

GitHubのコミット履歴をAIで分析し、図解レポートをSlackに自動投稿するツール。愛称「コミとら」。

### 基本方針

**「deterministic な処理は Python に書く、non-deterministic な処理だけ Claude に任せる」**

| 処理 | 担当 | 理由 |
|---|---|---|
| GitHub API からコミット取得 | Python | 毎回同じ手順・同じ結果が必要 |
| コミットをパスでフィルタリング | Python | 毎回同じ手順 |
| PlaywrightでHTMLをPNG化 | Python | 毎回同じ手順 |
| Slack投稿・メール送信 | Python | 毎回同じ手順 |
| GitHub Pages アップロード | Python | 毎回同じ手順 |
| コミット内容のビジネス視点要約 | Claude | 毎回異なる文章でよい |
| HTML図解の生成（全種類まとめて） | Claude（スキル） | 往復を最小化するため1回でまとめて生成 |

### 新しい処理フロー

```
[1] GitHub Actions（yaml）
      ↓ python main.py を呼び出す
[2] Python（main.py）
      ├─ GitHub API でコミット取得                      ← Python が担う
      ├─ コミットをパスでフィルタリング                        ← Python が担う
      ├─ Claude API で週次HTML図解を生成（1往復のみ）   ← Claude メインエージェント
      ├─ 生成HTMLのバリデーション                        ← Python が担う
      ├─ Claude API でレポート品質を評価                 ← Claude サブエージェント
      ├─ PlaywrightでHTMLをPNG化                     ← Python が担う
      └─ 配信
           ├─ Slack投稿 / メール送信
           └─ GitHub Pages アップロード
```

### スキルの扱い方（新方式）

```python
# SKILL.md の内容をプロンプトに直接埋め込む
def load_skills(paths: list[str]) -> str:
    result = "\n\n## スキル情報\n"
    for path in paths:
        result += open(path).read() + "\n\n"
    return result

# 呼び出し例
python main.py --skill code-analyzer --skill diagram-guidelines
```

### Claudeの呼び出し方（Anthropic SDK）

Prompt Caching を使い、変化しない固定コンテンツ（テンプレートHTML・スキル）をシステムプロンプトに配置してキャッシュする。
コミットデータ（毎回変わる）はユーザーメッセージに入れる。
これにより繰り返しの開発・デバッグ時のAPIコストを最大90%削減できる。

```python
import anthropic

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# メインエージェント：レポート生成
response = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=16000,
    system=[
        {
            "type": "text",
            "text": skill_and_template_content,   # 固定：SKILL.md + テンプレートHTML
            "cache_control": {"type": "ephemeral"} # ← Prompt Caching でキャッシュ
        }
    ],
    messages=[{"role": "user", "content": commits_data_prompt}]  # 毎回変わるデータ
)

# サブエージェント：レポート品質評価（別呼び出し）
review = client.messages.create(
    model="claude-sonnet-4-5",
    max_tokens=2048,
    messages=[{"role": "user", "content": f"以下のレポートHTMLを評価してください:\n{generated_html}"}]
)
```

---

## レポートのデザイン・コンテンツ仕様

### モックアップ

- `../mockups/comitora-mockup1.html`: ブランドガイドに則ったシンプルなデザイン
- `../mockups/comitora-mockup2.html`: 黒基調でモダンなデザイン

週次レポートのデザインモックアップ。このHTMLをテンプレートのベースとして使用する。

### レポートに含めるセクション

| セクション | データ元 | 担当 |
|---|---|---|
| ヘッダー（週・リポジトリ名・健全度バー） | 設定ファイル + PR・ブロッカー数から算出 | Python |
| スプリント進捗・進捗バー | GitHub Issues / Milestone API | Python |
| 統計カード（マージ数・レビュー待ち・ブロッカー・アクティブブランチ） | GitHub PR / Branch API | Python |
| ブランチ状況マップ（テーブル） | GitHub Branches + PR API | Python |
| アクションプランの内容（優先度付き） | コミット・PRデータを元に判断 | **Claude** |
| 今週のヒーロー（選出） | PR数・レビュー数・コミット数を集計 | Python |
| 今週のヒーロー（表彰コメント文） | スプリント状況を元に生成 | **Claude** |
| コントリビューターランキング | PR数・レビュー数から集計 | Python |
| チームメッセージ | スプリント状況を元に生成 | **Claude** |
| Tips | Git/GitHubなどのツールやプロジェクトに関連するtipsを生成 | **Claude** |
| フッター | 設定ファイル + 生成日時 | Python |

### テンプレート方式

モックのHTMLのプレースホルダー化で対応する。Claudeが担う部分のみスキルで生成し、残りはPythonがJinja2で流し込む。

```html
<!-- 固定値（モック） → プレースホルダー化 -->
<div style="font-size:2.2rem;font-weight:800;">14</div>
↓
<div style="font-size:2.2rem;font-weight:800;">{{ prs_merged }}</div>
```

### データ調達の注意点

- **スプリント進捗バー**: GitHubのMilestoneかIssueラベルの運用に依存。プロジェクトがMilestoneを使っていれば自動取得可能
- **ブランチ状況**: マージ済み・レビュー待ち・ブロッカー・停滞（stale）はPR状態と最終更新日から判定
- **今週のヒーロー**: PR数・レビュー数・コミット数を集計してPythonで選出し、コメント生成のみClaudeに依頼

---

## 開発ステップ

### Step 1: GitHub リポのデータを取得する Python スクリプトを作る

- 現行の `get-all-branch-commits.js` を Python に書き直す
- 呼び出しイメージ：

```bash
python get_commits.py \
  --owner your-username \
  --repo your-repo \
  --week 2026-W18 \
  --output /tmp/commits.json
```

- 出力フォーマット：

```json
[
  {
    "sha": "abc123",
    "message": "ログインページを修正",
    "author": "yamada",
    "branch": "feature/login",
    "files": ["src/login/index.py"]
  }
]
```

- 参考にするファイル：
  - `.claude/skills/github-api/scripts/get-all-branch-commits.js`
  - `.claude/skills/github-api/scripts/filter-commits-by-path.js`
  - `.claude/skills/github-api/scripts/lib/date-utils.js`
  - `.claude/skills/github-api/scripts/lib/normalize.js`

### Step 2: 取得したデータを元に週次HTMLレポートを作る Skill を作る

- Claude に渡すプロンプト（SKILL.md）を設計する
- 現行の `code-analyzer` / `diagram-guidelines` スキルを参考にする
- 入力：commits.json / 出力：週次レポートHTML 1枚（`/tmp/weekly-report.html`）
- **設計方針：レポートは1ファイルに統合し、1回のClaude呼び出しで生成する**
  - デザインテンプレート（プレースホルダー入りHTML）を `templates/` に用意しておく
  - スキルの指示：「このテンプレートのプレースホルダーをデータで埋めたHTMLを出力せよ」
  - Claudeはデータの解釈・文章生成のみ担当し、デザインはテンプレートが保証する
  - テンプレートはシステムプロンプトに配置してPrompt Cachingの対象にする

```
templates/
  weekly-report.html  ← デザインのお手本（プレースホルダー入り）

SKILL.md              ← 「テンプレートに従ってデータを埋めよ」という指示
```

### Step 3: 生成HTMLのバリデーションを追加する

- Claudeが返したHTMLをPythonでチェックする
- チェック項目：
  - 必須プレースホルダーが全て埋まっているか（`{{ }}`が残っていないか）
  - 必須セクション（ヘッダー・統計カード・アクションプランなど）が存在するか
  - HTMLとして構文的に壊れていないか
- バリデーション失敗時はエラーログを出力してパイプラインを中断する

### Step 4: サブエージェントによるレポート品質評価を追加する

- 生成・バリデーション済みのHTMLを別のClaude呼び出しに渡す
- 評価観点：
  - アクションプランの内容はコミットデータに基づいているか
  - チームメッセージ・ヒーローコメントは自然な日本語か
  - Tipsはプロジェクト文脈と関連しているか
- 評価結果（スコア・コメント）をログに記録する（低品質でも現時点では再生成は行わない）

### Step 5: スキルを実行する Python スクリプトを作る

- `main.py` として実装
- SKILL.md + テンプレートHTMLをシステムプロンプトに埋め込み（Prompt Caching対象）
- コミットデータをユーザーメッセージに入れて Anthropic SDK 経由で Claude を呼び出す
- Step 2.5 のバリデーション、Step 2.6 のサブエージェント評価もここで実行する

### Step 6: GitHub Actions で動かす

- `report-job.yml` を Python 実行に書き換える
- 必要な Secrets：`ANTHROPIC_API_KEY`, `GH_TOKEN`, `SLACK_BOT_TOKEN`（または SMTP設定）

---

## 参考リンク

- [Anthropic SDK（Python）](https://github.com/anthropics/anthropic-sdk-python)
- [Anthropic Prompt Caching ドキュメント](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Claude Code Skills](https://docs.anthropic.com/en/docs/claude-code/skills)
- [Slack API - files.getUploadURLExternal](https://api.slack.com/methods/files.getUploadURLExternal)

