---
name: commit-track
description: |
  GitHubコミット履歴を元にレポートHTMLを生成するスキル。
  「GitHubレポートを作って」「リポジトリの状況を可視化して」「コミとらを実行して」と依頼された際に使用する。
---

# Comitora レポート生成スキル

GitHub のコミット・PR・Issue データを元に、レポート HTML を生成する。
Python（Anthropic SDK）からの自動実行と、エージェントからの手動実行の両方に対応する。

---

## 依存ファイル（すべて `commit-track-tool/` 起点の相対パス）

| ファイル | 役割 |
|---|---|
| `template/model-answer.html` | **完成例**（品質基準・デザインパターンの実例） |
| `template/base.html` | **テンプレート**（すべての `{{ }}` プレースホルダーを埋める対象） |
| `output/report_data.json` | **入力データ**（DataCollector が生成した集計済みデータ） |
| `output/comitora-report.html` | **出力先**（生成した完全な HTML を保存する） |

---

## 生成指示

### Step 0: 前提確認（手動実行時のみ）

> Python 自動実行の場合はこの Step をスキップする。

`output/report_data.json` が存在するか確認する。

存在しない場合:
> `output/report_data.json` が見つかりません。先に DataCollector を実行してください。
> ```
> uv run python src/comitora_data_collector.py --owner オーナー名 --repo リポジトリ名
> ```

存在する場合: `output/report_data.json` を読み込む。

### Step 1: 完成例の確認

`template/model-answer.html` を読み、完成品の品質水準・デザインパターン・文体を把握する。
このファイルが唯一のデザインリファレンス。自己流で作らない。

### Step 2: データ構造の把握

`report_data.json` のキー構造：

| キー | 内容 |
|---|---|
| `metadata.period` | 対象期間ラベル（例: "直近7日間 (2026-04-27 ～ 2026-05-03)"） |
| `metadata.repository` | オーナー/リポジトリ名（例: "ug-kitamura/main-app"） |
| `metadata.generated_at` | 生成日時（例: "2026/05/03 08:00"） |
| `pr.summary` | merged_count, open_count, awaiting_review_count, feedback_in_progress_count, approved_count, draft_count |
| `pr.merged` | マージ済み PR 一覧（number, title, author, merged_at, branch, url） |
| `pr.open` | オープン PR 一覧（number, title, author, review_status, updated_at, url, draft） |
| `commit` | コミット一覧（sha, message, author.login, author.avatar_url, date, branch, files） |
| `branch.active_branches` | アクティブブランチ一覧（name, last_commit_date, is_default） |
| `issue.milestone` | マイルストーン一覧（title, progress_pct, closed_issues, total_issues, due_on） |
| `issue.open_count` | オープン Issue 数 |
| `issue.closed_count` | 期間内クローズ Issue 数 |
| `aggregate.progress` | 進捗度（%）= merged_prs / (merged + open) * 100 |
| `aggregate.contributors_ranked` | 貢献スコア順リスト（login, avatar_url, commits, prs_merged, reviews_submitted, issues_closed, score, rank） |
| `aggregate.hero` | ランク1位のメンバー（contributors_ranked の先頭と同じ） |

### Step 3: 全プレースホルダーを埋めて完全な HTML を出力する

`template/base.html` のすべての `{{ }}` を埋め、完全な HTML ファイルを出力する。
出力は HTML のみ。説明文・コードブロック記法は不要。

### Step 4: ファイルを保存する（手動実行時のみ）

> Python 自動実行の場合はこの Step をスキップする（Python 側が保存する）。

生成した HTML を `output/comitora-report.html` に保存する。
`output/` ディレクトリが存在しない場合は作成する。

保存完了後:
> `output/comitora-report.html` を生成しました。ブラウザで開いて確認できます。

---

## プレースホルダー一覧

### メタ情報・ヘッダー

| プレースホルダー | データソース | 例 |
|---|---|---|
| `{{ project_name }}` | `metadata.repository` のリポジトリ名部分 | `main-app` |
| `{{ week_label }}` | `metadata.period` | `直近7日間 (2026-04-27 ～ 2026-05-03)` |
| `{{ repo_name }}` | `metadata.repository` | `ug-kitamura/main-app` |
| `{{ generated_at }}` | `metadata.generated_at` | `2026/05/03 08:00 JST` |
| `{{ repo_url }}` | `https://github.com/` + `metadata.repository` | GitHub リポジトリ URL |
| `{{ past_reports_url }}` | `#`（リンク先未設定） | `#` |

### 健全度バー

`aggregate.progress` の値に応じて色を決定する。

| 条件 | `{{ health_color_class }}` | `{{ health_color_value }}` | `{{ health_emoji }}` |
|---|---|---|---|
| ≥ 80% | `progress-green` | `var(--green-50)` | 🟢 |
| 50〜79% | `progress-yellow` | `var(--yellow-70)` | 🟡 |
| < 50% | `progress-gray` | `var(--gray-50)` | 🔴 |

`{{ health_pct }}` = `aggregate.progress` の整数値（例: `72`）

### 統計カード

| プレースホルダー | データソース |
|---|---|
| `{{ prs_merged }}` | `pr.summary.merged_count` |
| `{{ awaiting_review }}` | `pr.summary.awaiting_review_count` |
| `{{ blockers }}` | `pr.summary.feedback_in_progress_count` |
| `{{ active_branches }}` | `branch.active_branches` の件数 |

### スプリント進捗 `{{ sprint_items }}`

`issue.milestone` の各エントリを以下のパターンで繰り返す。
マイルストーンがない場合は `<p class="text-muted text-sm">マイルストーンはありません</p>` を出力する。

マイルストーンタイトルは `milestone.url` へのリンクにする。

```html
<div>
  <div class="flex items-center justify-between mb-2">
    <span class="font-semibold">📌 <a href="milestone.url">マイルストーンタイトル</a></span>
    <span class="font-bold" style="color:var(--blue-50);">XX%</span>
  </div>
  <div class="progress-track" role="progressbar" aria-valuenow="XX" aria-valuemin="0" aria-valuemax="100" aria-label="タイトル 進捗 XX%">
    <div class="progress-bar progress-blue" style="width:XX%;"></div>
  </div>
  <div class="flex flex-wrap gap-2 mt-2">
    <span class="badge badge-success">N/M issues closed</span>
    <!-- due_on がある場合のみ追加 -->
    <span class="badge badge-neutral">📅 期限: YYYY-MM-DD</span>
  </div>
</div>
```

バッジのデータソース: `closed_issues` / `total_issues`（マイルストーンオブジェクトから直接取得）

### ブランチ状況マップ

`pr.open` と `branch.active_branches` を組み合わせて出力する。
表示対象は **オープン PR があるブランチ** + **直近更新の stale ブランチ**（最大 8 件）。

**ケース A — オープン PR あり:**

- `{{ branch_map_note }}` = 空文字（何も出力しない）
- `{{ branch_col_date }}` = `最終更新`
- `{{ branch_col_link }}` = `アクション`
- `{{ branch_rows }}` = 各ブランチの `<tr>`（`updated_at` を `YYYY/MM/DD` 形式で表示）

**ケース B — オープン PR が 0 件のフォールバック:**

- `{{ branch_map_note }}` = `<div class="text-xs text-muted mb-3">オープン PR なし — 直近マージ済みブランチを表示</div>`
- `{{ branch_col_date }}` = `マージ日時`
- `{{ branch_col_link }}` = `PR`
- `{{ branch_rows }}` = `pr.merged` の直近 5 件を `<tr>` で出力（`merged_at` を `YYYY/MM/DD` 形式で表示、PR 番号は `<a href="url">#N</a>` リンク）

**ステータスバッジのマッピング:**

| review_status / 状態 | バッジ |
|---|---|
| `awaiting_review` | `<span class="badge badge-warning">👀 Review待ち</span>` |
| `feedback_in_progress` | `<span class="badge badge-danger">🚧 Blocked</span>` |
| `approved` | `<span class="badge badge-success">✅ Approved</span>` |
| `draft` | `<span class="badge badge-neutral">📝 Draft</span>` |
| PR なし・アクティブ | `<span class="badge badge-info">🔨 In Progress</span>` |
| 最終更新 7日以上 | `<span class="badge badge-neutral">😴 Stale (Nd)</span>` |

**アバターカラーのアサイン:** メンバーごとに `avatar-blue` / `avatar-green` / `avatar-yellow` / `avatar-purple` / `avatar-gray` を順番に割り当てる。

ブランチ名は `https://github.com/owner/repo/tree/branchname` へのリンクにする。

```html
<tr>
  <td class="font-mono text-xs" style="color:var(--blue-40);"><a href="https://github.com/owner/repo/tree/branchname">ブランチ名</a></td>
  <td>
    <div class="flex items-center gap-2">
      <span class="avatar avatar-blue">イニシャル</span>
      <span>ログイン名 さん</span>
    </div>
  </td>
  <td><span class="badge badge-xxx">ステータス</span></td>
  <td class="text-xs text-muted">N days ago</td>
  <td class="text-xs text-muted">アクション（ある場合のみ）</td>
</tr>
```

### ヒーロー基本情報

| プレースホルダー | データソース |
|---|---|
| `{{ hero_initial }}` | `aggregate.hero.login` の先頭1文字（大文字） |
| `{{ hero_name }}` | `aggregate.hero.login` + ` さん` |

**`{{ hero_badges }}` — 突出した値のみバッジを表示するルール:**

値が `0` の場合はそのバッジを出力しない。`achievement` バッジは `commits > 0` なら常に出力する。

| 条件 | バッジ |
|---|---|
| `prs_merged > 0` | `<span class="badge badge-warning">🥇 N PRs merged</span>` |
| `reviews_submitted > 0` | `<span class="badge badge-success">💬 N reviews</span>` |
| `issues_closed > 0` | `<span class="badge badge-info">✅ N issues closed</span>` |
| `commits > 0` | `<span class="badge badge-info">achievement</span>`（スコアが最も高い項目を一言で: `⚡ コミット最多`、`🔍 レビュー最多` など） |

### コントリビューターリスト `{{ contributor_rows }}`

`aggregate.contributors_ranked` のランク 2 以降を以下のパターンで繰り返す（最大 5 件）。

```html
<div class="flex items-center gap-3">
  <span class="text-xs text-muted font-bold" style="width:16px;">N</span>
  <span class="avatar avatar-blue">イニシャル</span>
  <span class="flex-1">ログイン名 さん</span>
  <span class="text-xs text-muted">N PRs</span>
</div>
```

---

## Claude 生成セクション

### `{{ action_plan_items }}`

コミット・PR データを分析し、チームが対象期間中に取るべきアクションを優先度付きで生成する。

- 3〜5 件を目安に生成する
- 優先度は 🔴（最高）→ 🟠（高）→ 🟡（中）→ 🔵（情報）の 4 段階
- 「誰が・いつまでに」を必ず明記する（担当者不明の場合は「チームで決定」）
- ブロッカー・stale ブランチ・レビュー待ち PR に基づいた具体的な内容にする

```html
<div class="action-item action-p1">
  <span role="img" aria-label="最高優先度" style="font-size:16px;margin-top:2px;">🔴</span>
  <div>
    <div class="font-semibold">アクションのタイトル</div>
    <div class="text-xs action-meta mt-1">担当者 → 期限</div>
  </div>
</div>
```

優先度クラス対応: `action-p1`（🔴）/ `action-p2`（🟠）/ `action-p3`（🟡）/ `action-p4`（🔵）

---

### `{{ hero_comment }}`

対象期間のヒーロー（`aggregate.hero`）への表彰コメントを生成する。

- コミット・PR・レビューの実績から具体的なエピソードを引用する
- チームへの貢献が伝わる前向きなトーンで書く
- 日本語 1〜2 文 + English 1 文の 2 段構成

```html
"日本語のコメント文。"
<p class="mt-2 italic text-xs text-muted" style="line-height:1.6;">
  "English version."
</p>
```

---

### `{{ team_message }}`

スプリントの状況を踏まえた、チーム全体への励ましメッセージを生成する。

- 対象期間の進捗（マージ数・ブロッカー数）を反映した内容にする
- 課題があっても前向きに。ネガティブな表現は禁止
- 日本語メイン + 末尾に English 要約の 2 段構成

```html
<p class="font-semibold" style="color:var(--gray-15);">🚀 タイトル</p>
<p class="text-secondary text-sm mt-2" style="line-height:1.7;">
  日本語のメッセージ本文。
</p>
<div class="divider"></div>
<p class="italic text-xs text-muted" style="line-height:1.6;">
  "English summary."
</p>
```

---

### `{{ tips_content }}`

対象期間のコミット・PR 内容に関連する Git / GitHub の実践的な Tips を 1 件生成する。

- 対象期間の実際の作業内容と関連するテーマを選ぶ
- エンジニアが「なるほど、使える」と思えるコマンドや手法を紹介する
- コードブロックを含め、具体的な使い方を示す

```html
<div class="flex items-start gap-3 mb-3">
  <div style="width:36px;height:36px;border-radius:8px;background:var(--green-95);border:1px solid var(--green-85);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🌿</div>
  <div>
    <div class="font-bold" style="font-size:18px;color:var(--blue-40);">`git コマンド`</div>
    <div class="text-xs text-muted mt-1">コマンドの一行説明</div>
  </div>
</div>
<div class="code-block">
  <div class="code-comment"># コメント</div>
  <div class="code-cmd mt-1">$ コマンド例</div>
  <div class="code-output">出力例</div>
</div>
<p class="text-xs text-muted" style="line-height:1.6;">
  日本語の解説。<br/>
  <span class="italic">English summary.</span>
</p>
```

---

## レビュー指示

Python から生成済みの HTML が渡されるので、以下の観点で評価し、**JSON のみを返す**。

### 評価観点

1. **データ転記の正確性**: report_data.json の数値（PR数・コミット数など）が HTML に正しく反映されているか
2. **アクションプランの具体性**: コミット・PR データに基づいているか。「誰が・いつまでに」が明記されているか
3. **ヒーローコメントの妥当性**: 実績と一致しているか。自然な日本語か
4. **チームメッセージのトーン**: 対象期間の状況を反映しているか。前向きなトーンか
5. **Tips の関連性**: 対象期間の作業内容と関連しているか。実践的で役立つ内容か

### 出力形式（JSON のみ・説明文不要）

```json
{
  "score": 1から5の整数,
  "data_accuracy": "コメント",
  "action_plan_quality": "コメント",
  "hero_comment_quality": "コメント",
  "team_message_quality": "コメント",
  "tips_quality": "コメント",
  "improvements": ["改善点1", "改善点2"]
}
```
