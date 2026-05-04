---
name: commit-track
description: |
  GitHubコミット履歴を元にレポートHTMLを生成するスキル。
  「GitHubレポートを作って」「リポジトリの状況を可視化して」「コミとらを実行して」と依頼された際に使用する。
---

# Comitora レポート生成スキル

GitHub のコミット・PR・Issue データを元にレポート HTML を生成する。
Python（Anthropic SDK）からの自動実行と、エージェントからの手動実行の両方に対応する。

---

## 依存

本スキルは `commit-track-tool/` をカレントディレクトリにして行う。
パスは `commit-track-tool/` フォルダからの相対パスを表す。
`output/` フォルダは `.gitignore` に登録されているため、ファイル検索時は注意すること。

| ファイル | 役割 |
|---|---|
| `.claude/skills/commit-track/references/base.html` | レポートテンプレート（`{{ }}` を埋める「額縁」） |
| `.claude/skills/commit-track/references/model-answer.html` | 模範回答（デザイン・構成の SSoT）。base と同一の額縁を含む完成 HTML |
| `output/report_data.json` | 入力データ |
| `output/comitora-report.html` | 出力先 |

---

## ワークフロー

### Step 0: 前提確認

`output/report_data.json` が存在するか確認する。
存在しない場合は以下のメッセージを出力し、処理を終了する。
**重要** AIの判断で `data collector` を勝手に実行しないこと。

> `output/report_data.json` が見つかりません。先に `data collector` を実行してください。
> ```
> uv run python src/comitora_data_collector.py --owner オーナー名 --repo リポジトリ名
> ```

### Step 1: 模範回答の読み込み

`.claude/skills/commit-track/references/model-answer.html` を読み、以下を把握する:

- 完成品の品質水準
- デザインパターン（色使い・余白・カード・フロー図などの視覚表現）
- Tailwind CSSクラスの使い方
- Lucide Iconsの使い方
- コンテンツの構成・情報量・説明の深さ

模範回答がデザインガイドラインの代わりになる。パーツ一覧やルールではなく、実物から読み取る。

### Step 2: データを読み込み、プレースホルダーをすべて埋める

`output/report_data.json` を読み込み、`references/base.html` のすべての `{{ }}` を埋めて完全な HTML を出力する。

### Step 3: 保存（手動実行時のみ）

生成した HTML を `output/comitora-report.html` に保存する。`output/` がなければ作成する。

### Step 4: レビュー

**レビュー指示**に従い、生成された `output/comitora-report.html` をレビュー評価する。
評価した結果をマークダウン形式で `output/comitora-evaluate.md` に保存する。

---

## データマッピング

### メタ情報・ヘッダー

| プレースホルダー | データソース |
|---|---|
| `{{ project_name }}` | `metadata.repository` のリポジトリ名部分 |
| `{{ period_label }}` | `metadata.period` |
| `{{ repo_name }}` | `metadata.repository` |
| `{{ repo_url }}` | `https://github.com/` + `metadata.repository` |
| `{{ generated_at }}` | `metadata.generated_at` |
| `{{ past_reports_url }}` | `#` |
| `{{ health_pct }}` | `aggregate.health.pct`（0〜100 の整数） |
| `{{ comitora_logo_data_uri }}` | **AIスキルでは置換しない**（`{{ comitora_logo_data_uri }}` をそのまま残す）。後の工程でPythonスクリプトが画像データを埋め込むため。 |

### 健全度バー

| 条件 | 健全度の値 | `{{ health_color_value }}` | `{{ health_icon }}` |
|---|---|---|---|
| ≥ 80% | `aggregate.health.pct` | `#007BC0` | `circle-check` |
| 50〜79% | 〃 | `#CDA600` | `alert-circle` |
| < 50% | 〃 | `#ED0007` | `alert-triangle` |

### 統計カード

| プレースホルダー | データソース |
|---|---|
| `{{ prs_merged }}` | `pr.summary.merged_count` |
| `{{ awaiting_review }}` | `pr.summary.awaiting_review_count` |
| `{{ blockers }}` | `pr.summary.feedback_in_progress_count` |
| `{{ active_branches }}` | `branch.active_branches` の件数 |
| `{{ open_issues }}` | `issue.open_count` |

### ヒーロー

| プレースホルダー | データソース |
|---|---|
| `{{ hero_avatar_url }}` | `aggregate.hero.avatar_url` |
| `{{ hero_name }}` | `aggregate.hero.login` + ` さん` |

---

## 条件ロジック

### `{{ milestone_items }}`

- `issue.milestone` の各エントリを繰り返す。
- マイルストーンがなければ `<p>マイルストーンはありません</p>` を出力し、全issue数に対するクローズしたissue数のバーを表示する。
- マイルストーンタイトルは `milestone.url` へリンクする。
- マイルストーン名に応じてアイコンを選ぶ。適切なアイコンがない場合は意味・雰囲気が近い別のアイコンで代用してよい。

### `{{ branch_rows }}` と周辺プレースホルダー

- **まず** `pr.open` の各行から生成する。最終更新が直近のものから並べる。
- **次に** `pr.merged` の各行から生成する。最終更新が直近のものから並べる。最終更新列はマージ日時とする。PR列は空白にする（PRリンクは置かない）。

ブランチ名は `https://github.com/owner/repo/tree/branchname` へリンクする。

### `{{ hero_badges }}`

`aggregate.hero` の各値が `0` の場合はそのバッジを出力しない。

| 条件 | バッジデザイン | バッジ内容 |
|---|---|---|
| `prs_merged > 0` | amber バッジ（git-merge アイコン） | 「N PRs merged」など |
| `issues_closed > 0` | green バッジ（check-circle アイコン） | 「N issues closed」など |
| `reviews_submitted > 0` | blue バッジ（eye アイコン） | 「N reviews」など |
| `commits > 0` | purple バッジ（zap アイコン） | 「N commits」など |

### `{{ contributor_rows }}`

`aggregate.contributors_ranked` の全メンバーを1行ずつ出力する。
人数が少ない（2名以下）の場合、「多くの人の参加をお待ちしています！」などのコメントを添える。

---

## AI 生成セクション

### `{{ action_plan_items }}`（4〜6件）

コミット・PR・Issue データから取るべきアクションを生成する。
- 「誰が」と「いつまで」をバッジで明示する
- 担当者が特定できない場合 → 「担当: 要確認」バッジ（amber）
- 期限が不明または曖昧な場合 → 「期限: 要確認」バッジ（amber）

### `{{ hero_comment }}`

対象期間の実績（コミット数・PR数・マージ数・レビュー数・Issueクローズ数など）から具体的なエピソードを引用し、チームへの貢献が伝わる前向きなトーンで書く。
日本語メイン ＋ 英語の2段構成。

### `{{ team_message }}`

対象期間の進捗（コミット数・ブランチの状況・PRの状況・Issueの状況など）を反映した励ましメッセージ。
課題があっても前向きに。ネガティブな表現は禁止。日本語メイン ＋ 英語の2段構成。

### `{{ tips_content }}`

対象期間の作業内容（ブランチ名・コミットメッセージ・ファイル変更など）と関連するツール（Git/GitHub/Pythonなど）の実践的Tipsを1件生成する。
コードブロックを含め具体的な使い方を示す。

---

## レビュー指示

サブエージェントを2つ起動し、各評価観点に対し1～5点で採点する（良い:5点 / 悪い:1点）。合計50点満点。
評価と改善案の提案のみ行い、成果物やスキルの更新はしない。

### サブエージェント1: プロジェクトマネージメントのエキスパート

評価観点:
- ① データ転記の正確性
- ② アクションプランの具体性（誰が・いつまでに）
- ③ ヒーローコメントの妥当性
- ④ チームメッセージのトーン
- ⑤ お役立ちの有用性

### サブエージェント2: UI/UX のエキスパート

評価観点:
- ① 情報の階層とスキャンしやすさ（見出し・余白・カード分割）
- ② タイポグラフィとコントラスト（薄字・数字の可読性）
- ③ アイコンとラベルの対応が直感的か
- ④ 表・バッジ・リンクの一貫性
- ⑤ モバイル幅での折り返し・横スクロールの妥当性

