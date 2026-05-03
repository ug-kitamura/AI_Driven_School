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

パスはリポジトリルートからの相対パス。

| ファイル | 役割 |
|---|---|
| `commit-track-tool/.claude/skills/commit-track/references/base.html` | レポートテンプレート（`{{ }}` を埋める「額縁」。スキル同梱） |
| `commit-track-tool/.claude/skills/commit-track/references/model-answer.html` | 模範回答（デザイン・構成の SSoT）。base と同一の額縁を含む完成 HTML |
| `commit-track-tool/output/report_data.json` | 入力データ（DataCollector が生成） |
| `commit-track-tool/output/comitora-report.html` | 出力先 |

---

## ワークフロー

### Step 0: 前提確認

`commit-track-tool/output/report_data.json` が存在するか確認する。存在しない場合:

> `output/report_data.json` が見つかりません。先に `data collector` を実行してください。
> ```
> uv run python src/comitora_data_collector.py --owner オーナー名 --repo リポジトリ名
> ```

### Step 1: 模範回答の読み込み

`commit-track-tool/.claude/skills/commit-track/references/model-answer.html` を読み、以下を把握する:

- 完成品の品質水準
- デザインパターン（色使い・余白・カード・フロー図などの視覚表現）
- Tailwind CSSクラスの使い方
- Lucide Iconsの使い方
- コンテンツの構成・情報量・説明の深さ

模範回答がデザインガイドラインの代わりになる。パーツ一覧やルールではなく、実物から読み取る。

### Step 2: データを読み込み、プレースホルダーをすべて埋める

`commit-track-tool/output/report_data.json` を読み込み、`references/base.html`（上記依存表のパス）のすべての `{{ }}` を埋めて完全な HTML を出力する。

### Step 3: 保存（手動実行時のみ）

生成した HTML を `commit-track-tool/output/comitora-report.html` に保存する（`output/` がなければ作成する）。

### Step 4: レビュー

生成された `output/comitora-report.html` に対して評価する。
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

### 健全度バー

| 条件 | `{{ health_pct }}` | `{{ health_color_value }}` | `{{ health_icon }}` |
|---|---|---|---|
| ≥ 80% | `aggregate.progress` | `#007BC0` | `circle-check` |
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

レポート内の GitHub アバター画像はすべて **`ring-1 ring-slate-200`** で薄いグレーの枠を統一する（ヒーロー `w-16 h-16`、貢献者行 `w-10 h-10`、ブランチマップ担当列 `w-7 h-7`）。

---

## 条件ロジック

### `{{ milestone_items }}`

`issue.milestone` の各エントリを繰り返す。マイルストーンがなければ `<p>マイルストーンはありません</p>` を出力する。
マイルストーンタイトルは `milestone.url` へリンクする。
マイルストーン名に応じてアイコンを選ぶ: 例 `Apple` → apple / `Banana` → banana / `Cherry` → cherry

### `{{ branch_rows }}` と周辺プレースホルダー

- `pr.open` に件数あり → `branch_map_note` = 空文字。`branch_col_date` = `最終更新`、`branch_col_link` = `アクション`、行は `pr.open` から生成
- `pr.open` が 0 件 → `branch_map_note` = 注釈要素。`branch_col_date` = `マージ日時`、`branch_col_link` = `PR`、行は `pr.merged` 直近5件から生成（マージ日を `YYYY/MM/DD` 形式、PR 番号をリンクで表示）

ブランチ名は `https://github.com/owner/repo/tree/branchname` へリンクする。

担当列は PR の著者アバターを表示する。`pr.open` の各行では `author.avatar_url`、`pr.merged` の各行でも `author.avatar_url` を `<img src="…" alt="" class="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 flex-shrink-0" width="28" height="28" />` で表示し、その横に `author.login` + ` さん`。初期文字のカラー丸アイコンは使わない。

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

対象期間の実績（コミット数・PR 数・Issue クローズ数）から具体的なエピソードを引用し、チームへの貢献が伝わる前向きなトーンで書く。
日本語メイン ＋ 英語の2段構成。

### `{{ team_message }}`

マイルストーンの進捗（コミット数・マージ数など）を反映した励ましメッセージ。
課題があっても前向きに。ネガティブな表現は禁止。日本語メイン ＋ 英語の2段構成。

### `{{ tips_content }}`

対象期間の作業内容（ブランチ名・コミットメッセージ・ファイル変更）と関連する Git / GitHub の実践的 Tips を 1 件生成する。
コードブロックを含め具体的な使い方を示す。

---

## レビュー指示

サブエージェントを３つ起動し、各評価観点に対し1～5点で採点する。（良い:5点 / 悪い:1点）
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

