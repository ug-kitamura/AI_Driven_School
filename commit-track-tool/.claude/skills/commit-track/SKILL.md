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
| `issue.milestone` | マイルストーン一覧（title, progress_pct, closed_issues, total_issues, due_on, url） |
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

`aggregate.progress` の値に応じて色とアイコンを決定する。

| 条件 | `{{ health_color_value }}` | `{{ health_icon }}` |
|---|---|---|
| ≥ 80% | `#007BC0` | `circle-check` |
| 50〜79% | `#CDA600` | `alert-circle` |
| < 50% | `#ED0007` | `alert-triangle` |

`{{ health_pct }}` = `aggregate.progress` の整数値（例: `72`）

### 統計カード

| プレースホルダー | データソース |
|---|---|
| `{{ prs_merged }}` | `pr.summary.merged_count` |
| `{{ awaiting_review }}` | `pr.summary.awaiting_review_count` |
| `{{ blockers }}` | `pr.summary.feedback_in_progress_count` |
| `{{ active_branches }}` | `branch.active_branches` の件数 |
| `{{ open_issues }}` | `issue.open_count` |

### スプリント進捗 `{{ sprint_items }}`

`issue.milestone` の各エントリを以下のパターンで繰り返す。
マイルストーンがない場合は `<p class="text-sm text-slate-500">マイルストーンはありません</p>` を出力する。

マイルストーンタイトルは `milestone.url` へのリンクにする。

マイルストーンアイコン対応（大文字小文字を問わず先頭一致）:
- `apple` → `<i data-lucide="apple" class="w-4 h-4 text-red-400">`
- `banana` → `<i data-lucide="banana" class="w-4 h-4 text-yellow-600">`
- `cherry` → `<i data-lucide="cherry" class="w-4 h-4 text-red-400">`
- その他 → `<i data-lucide="gem" class="w-4 h-4 text-purple-400">`

```html
<div>
  <div class="flex items-center justify-between mb-2">
    <a href="{{ milestone.url }}"
       class="flex items-center gap-2 font-semibold text-slate-800 hover:text-custom-blue text-sm transition-colors">
      <!-- マイルストーンアイコン -->タイトル
    </a>
    <!-- 100%: text-custom-blue / 0%: text-slate-400 -->
    <span class="font-bold text-sm">XX%</span>
  </div>
  <div class="h-2 bg-slate-200 rounded-full overflow-hidden">
    <!-- 100%: bg-custom-blue / 0%: bg-slate-300 -->
    <div class="h-full rounded-full" style="width:XX%;"></div>
  </div>
  <div class="flex flex-wrap gap-1.5 mt-2">
    <!-- closed_issues > 0: green badge -->
    <span class="inline-flex items-center gap-1 bg-custom-green-lt text-custom-green border border-green-100 rounded-full px-2.5 py-0.5 text-xs font-semibold">
      <i data-lucide="check" class="w-3 h-3"></i>N/M issues closed
    </span>
    <!-- closed_issues == 0: neutral badge -->
    <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
      0/M issues closed
    </span>
    <!-- due_on がある場合のみ追加 -->
    <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2.5 py-0.5 text-xs font-medium">
      <i data-lucide="calendar" class="w-3 h-3"></i>期限: YYYY-MM-DD
    </span>
  </div>
</div>
```

### ブランチ状況マップ

`pr.open` と `branch.active_branches` を組み合わせて出力する。

**ケース A — オープン PR あり:**

- `{{ branch_map_note }}` = 空文字（何も出力しない）
- `{{ branch_col_date }}` = `最終更新`
- `{{ branch_col_link }}` = `アクション`
- `{{ branch_rows }}` = 各ブランチの `<tr>`（`updated_at` を `YYYY/MM/DD` 形式で表示）

**ケース B — オープン PR が 0 件のフォールバック:**

- `{{ branch_map_note }}` = `<div class="text-xs text-slate-500 mb-4">オープン PR なし — 直近マージ済みブランチを表示</div>`
- `{{ branch_col_date }}` = `マージ日時`
- `{{ branch_col_link }}` = `PR`
- `{{ branch_rows }}` = `pr.merged` の直近 5 件を `<tr>` で出力（`merged_at` を `YYYY/MM/DD` 形式で表示、PR 番号は `<a href="url">#N</a>` リンク）

**ステータスバッジのマッピング（Tailwind）:**

| review_status / 状態 | バッジ HTML |
|---|---|
| `awaiting_review` | `<span class="inline-flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="eye" class="w-3 h-3"></i>Review待ち</span>` |
| `feedback_in_progress` | `<span class="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="alert-circle" class="w-3 h-3"></i>Blocked</span>` |
| `approved` | `<span class="inline-flex items-center gap-1 bg-custom-green-lt text-custom-green border border-green-100 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="check-circle" class="w-3 h-3"></i>Approved</span>` |
| `draft` | `<span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="file-pen" class="w-3 h-3"></i>Draft</span>` |
| PR なし・アクティブ | `<span class="inline-flex items-center gap-1 bg-custom-blue-lt text-custom-blue border border-blue-100 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="hammer" class="w-3 h-3"></i>In Progress</span>` |
| マージ済み | `<span class="inline-flex items-center gap-1 bg-custom-green-lt text-custom-green border border-green-100 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="check-circle" class="w-3 h-3"></i>Merged</span>` |

**アバター背景色のアサイン（メンバー順に循環）:**
`bg-custom-blue` → `bg-custom-green` → `bg-amber-500` → `bg-purple-500` → `bg-slate-400`

ブランチ名は `https://github.com/owner/repo/tree/branchname` へのリンクにする。

```html
<tr class="border-b border-slate-50 hover:bg-custom-blue-lt transition-colors">
  <td class="py-3 pr-4">
    <a href="https://github.com/owner/repo/tree/branchname"
       class="font-mono text-xs text-custom-blue hover:underline">ブランチ名</a>
  </td>
  <td class="py-3 pr-4">
    <div class="flex items-center gap-2">
      <div class="w-7 h-7 rounded-full bg-custom-blue flex items-center justify-center text-white text-xs font-bold flex-shrink-0">イニシャル</div>
      <span class="text-slate-700 text-sm">ログイン名 さん</span>
    </div>
  </td>
  <td class="py-3 pr-4"><!-- ステータスバッジ --></td>
  <td class="py-3 pr-4 text-xs text-slate-500">YYYY/MM/DD</td>
  <td class="py-3 text-xs"><a href="PR URL" class="text-custom-blue hover:underline">#N</a></td>
</tr>
```

### ヒーロー基本情報

| プレースホルダー | データソース |
|---|---|
| `{{ hero_initial }}` | `aggregate.hero.login` の先頭1文字（大文字） |
| `{{ hero_name }}` | `aggregate.hero.login` + ` さん` |

**`{{ hero_badges }}` — 突出した値のみバッジを表示するルール:**

値が `0` の場合はそのバッジを出力しない。`commits > 0` の achievement バッジは常に出力する。

| 条件 | バッジ HTML |
|---|---|
| `prs_merged > 0` | `<span class="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="git-merge" class="w-3 h-3"></i>N PRs merged</span>` |
| `issues_closed > 0` | `<span class="inline-flex items-center gap-1 bg-green-100 text-green-700 border border-green-300 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="check-circle" class="w-3 h-3"></i>N issues closed</span>` |
| `reviews_submitted > 0` | `<span class="inline-flex items-center gap-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="eye" class="w-3 h-3"></i>N reviews</span>` |
| `commits > 0` | `<span class="inline-flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-300 rounded-full px-2.5 py-0.5 text-xs font-semibold"><i data-lucide="zap" class="w-3 h-3"></i>コミット最多</span>`（最も高いスコア項目を一言で） |

### コントリビューターリスト `{{ contributor_rows }}`

`aggregate.contributors_ranked` の**全メンバー**を以下のパターンで繰り返す。
メンバーが 1 名のみの場合は行の後に注釈を追加する。

```html
<!-- 各メンバー -->
<div class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-custom-blue to-green-300 flex items-center justify-center text-white text-lg font-black flex-shrink-0">イニシャル</div>
  <div class="flex-1 min-w-0">
    <div class="font-semibold text-slate-800 text-sm">ログイン名</div>
    <div class="flex flex-wrap gap-1 mt-1">
      <span class="inline-flex items-center gap-0.5 bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-xs">
        <i data-lucide="git-commit-horizontal" class="w-3 h-3"></i>N commits
      </span>
      <span class="inline-flex items-center gap-0.5 bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-xs">
        <i data-lucide="git-merge" class="w-3 h-3"></i>N PRs merged
      </span>
      <!-- issues_closed > 0 の場合のみ -->
      <span class="inline-flex items-center gap-0.5 bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 text-xs">
        <i data-lucide="check-circle" class="w-3 h-3"></i>N issues closed
      </span>
    </div>
  </div>
  <div class="flex-shrink-0 text-right">
    <div class="text-xs text-slate-500 mb-0.5">スコア</div>
    <div class="text-xl font-black text-custom-blue">N</div>
  </div>
</div>

<!-- 1名のみの場合の注釈 -->
<p class="text-xs text-slate-500 mt-4 leading-relaxed">現在のコントリビューターは1名です。チームメンバーの追加をお待ちしています！</p>
```

---

## Claude 生成セクション

### `{{ action_plan_items }}`

コミット・PR データを分析し、チームが対象期間中に取るべきアクションを 3〜5 件生成する。

- `circle-arrow-right` アイコンで全アイテムを統一（色分け・優先度ドットは使わない）
- 「誰が」と「いつまで」を必ずバッジで明示する
- 担当者が不明な場合 → `担当: 要確認` バッジ（amber）
- 期限が不明または曖昧な場合 → `期限: 要確認` バッジ（amber）

```html
<div class="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
  <i data-lucide="circle-arrow-right" class="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0"></i>
  <div class="flex-1 min-w-0">
    <div class="font-semibold text-slate-800 text-sm">アクションのタイトル</div>
    <div class="text-xs text-slate-600 mt-1">詳細説明</div>
    <div class="flex flex-wrap gap-1.5 mt-2">
      <!-- 担当者が判明している場合 -->
      <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5 text-xs font-medium">
        <i data-lucide="user" class="w-3 h-3"></i>担当者名
      </span>
      <!-- 担当者が不明の場合 -->
      <span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 text-xs font-medium">
        <i data-lucide="alert-circle" class="w-3 h-3"></i>担当: 要確認
      </span>
      <!-- 期限が判明している場合 -->
      <span class="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5 text-xs font-medium">
        <i data-lucide="calendar" class="w-3 h-3"></i>YYYY-MM-DD
      </span>
      <!-- 期限が不明または曖昧な場合 -->
      <span class="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 text-xs font-medium">
        <i data-lucide="alert-circle" class="w-3 h-3"></i>期限: 要確認
      </span>
    </div>
  </div>
</div>
```

---

### `{{ hero_comment }}`

対象期間のヒーロー（`aggregate.hero`）への表彰コメントを生成する。

- コミット・PR・レビューの実績から具体的なエピソードを引用する
- チームへの貢献が伝わる前向きなトーンで書く
- 日本語 1〜2 文 + English 1 文の 2 段構成

```html
"日本語のコメント文。"
<div class="border-t border-slate-200 mt-3 pt-3 text-xs text-slate-500 italic">
  "English version."
</div>
```

---

### `{{ team_message }}`

スプリントの状況を踏まえた、チーム全体への励ましメッセージを生成する。

- 対象期間の進捗（マージ数・ブロッカー数）を反映した内容にする
- 課題があっても前向きに。ネガティブな表現は禁止
- 日本語メイン + 末尾に English 要約の 2 段構成

```html
<p class="font-semibold text-slate-900">タイトル</p>
<p class="text-slate-600 text-sm mt-2 leading-relaxed">
  日本語のメッセージ本文。
</p>
<div class="border-t border-slate-100 mt-4 pt-4">
  <p class="text-xs text-slate-500 leading-relaxed">
    English summary.
  </p>
</div>
```

---

### `{{ tips_content }}`

対象期間のコミット・PR 内容に関連する Git / GitHub の実践的な Tips を 1 件生成する。

- 対象期間の実際の作業内容と関連するテーマを選ぶ
- エンジニアが「なるほど、使える」と思えるコマンドや手法を紹介する
- コードブロックを含め、具体的な使い方を示す

```html
<div class="flex items-start gap-3 mb-4">
  <div class="w-9 h-9 rounded-lg bg-custom-green-lt border border-green-100 flex items-center justify-center flex-shrink-0">
    <i data-lucide="leaf" class="w-5 h-5 text-custom-green"></i>
  </div>
  <div>
    <div class="font-bold text-custom-blue font-mono text-base">`git コマンド`</div>
    <div class="text-xs text-slate-500 mt-0.5">コマンドの一行説明</div>
  </div>
</div>
<div class="bg-slate-800 rounded-xl p-4 font-mono text-xs leading-loose overflow-x-auto mb-3">
  <div class="text-slate-400"># コメント</div>
  <div class="text-teal-300 mt-1">$ コマンド例</div>
  <div class="text-slate-400">出力例</div>
</div>
<p class="text-xs text-slate-500 leading-relaxed">
  日本語の解説。<code class="bg-slate-100 px-1 rounded text-slate-700 font-mono">--option</code> の説明。
</p>
<div class="border-t border-slate-100 mt-3 pt-3">
  <p class="text-xs text-slate-500 italic leading-relaxed">
    English summary.
  </p>
</div>
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
