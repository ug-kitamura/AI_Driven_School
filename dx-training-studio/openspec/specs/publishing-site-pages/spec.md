# publishing-site-pages Specification

## Purpose

公開サイトのページ構成（トップページ3階層・レッスンページ・パンくず・バッジ・静的 export）の要件を規定する。

## Requirements

### Requirement: サイトは静的 export で全ページを生成できる

サイトは Nextra 4（Next.js）で構築し、`output: 'export'` で全ページを静的 HTML として生成できなければならない（SHALL）。サーバーランタイムを前提とする機能（Route Handlers・middleware・画像最適化）に依存してはならない（SHALL NOT）。GitHub Pages のサブパス配信（`basePath`）と Vercel のルート配信の両方でリンク・アセットが解決できなければならない（SHALL）。

#### Scenario: 静的 export が通る

- **WHEN** 変換済みの `content/` がある状態で `next build`（export 設定）を実行する
- **THEN** `out/` に全ページの HTML が生成される

#### Scenario: basePath 配信でアセットが解決する

- **WHEN** `basePath` を設定してビルドし、サブパス配下で配信する
- **THEN** ページ内のリンクと画像・JS・CSS が 404 にならない

### Requirement: 全体・シリーズ・コースのトップページを自動生成する

3階層のトップページを、正本のメタデータから自動生成しなければならない（SHALL）。手書きの紹介文ファイルを要求してはならない（SHALL NOT）。

- **全体トップ**: サイト名・全体 `description`（`contents/.meta.json`）・グローバル曼陀羅・シリーズ一覧（各 `description` 付き）
- **シリーズトップ**: ヒーロー（`cover` 画像＋シリーズ名＋`catch`＋最初のレッスンへの導線）・`description`・シリーズ曼陀羅・コース一覧（`target`・`description`・レッスン数・合計所要時間付き）
- **コーストップ**: `catch`・`target`・`description`・ミニ曼陀羅・レッスン一覧（各レッスンの `description`・所要時間付き）

`cover` はシリーズトップのみが使う（SHALL）。`cover` 未設定のシリーズはヒーローを画像なしで描画し、エラーにしてはならない（SHALL NOT）。

#### Scenario: シリーズトップの構成

- **WHEN** `cover` / `catch` / `description` を持つシリーズのトップページを開く
- **THEN** ヒーローに cover 画像・シリーズ名・catch が表示され、その下に description・曼陀羅・コース一覧が並ぶ

#### Scenario: cover 未設定でも壊れない

- **WHEN** `cover` を持たないシリーズのトップページを開く
- **THEN** ヒーローは画像なしで描画され、ビルドも表示もエラーにならない

#### Scenario: コーストップのレッスン一覧

- **WHEN** 3レッスンを持つコースのトップページを開く
- **THEN** レッスンが `order` の順に、それぞれの description と所要時間つきで一覧される

### Requirement: レッスンページとパンくず

各レッスンは本文（frontmatter を除いた markdown）を描画するページとして生成されなければならない（SHALL）。frontmatter の生テキストを読者に見せてはならない（SHALL NOT）。本文中の画像プロンプト（HTML コメント）を読者向け出力に含めてはならない（SHALL NOT）。

各ページには **シリーズ → コース → レッスン** のパンくずを表示し、各段が対応するトップページへのリンクでなければならない（SHALL）。

#### Scenario: レッスン本文の描画

- **WHEN** GFM 表・コードブロック・画像・GitHub アラートを含むレッスンページを開く
- **THEN** それぞれが整形されて表示され、frontmatter と HTML コメントは表示されない

#### Scenario: パンくずから遡れる

- **WHEN** レッスンページのパンくずでコース名をクリックする
- **THEN** そのコースのトップページへ遷移する

### Requirement: 全 status を公開し、未完成にはバッジを出す

レッスンは `status` の値によらず公開しなければならない（SHALL）。`status` が `done` 以外のレッスンには、目次（コーストップの一覧・サイドバー相当）とレッスンページ本体の両方で、状態が分かるバッジ（`in_progress`=執筆中、`open`=未着手）を表示しなければならない（SHALL）。`done` のレッスンにはバッジを表示してはならない（SHALL NOT）。

#### Scenario: 執筆中レッスンのバッジ

- **WHEN** `status: in_progress` のレッスンをコーストップとレッスンページで見る
- **THEN** どちらにも「執筆中」を示すバッジが表示される

#### Scenario: 完成レッスンにはバッジが出ない

- **WHEN** `status: done` のレッスンを見る
- **THEN** 状態バッジは表示されない
