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

- **全体トップ**: ヒーロー画像（サイト専用アセット。下記）・サイト名・全体 `description`（`contents/.meta.json`）・グローバル曼陀羅・シリーズ一覧（各 `description` 付き）
- **シリーズトップ**: ヒーロー（シリーズ名＋`catch`＋最初のレッスンへの導線。**画像は置かない**）・`description`・シリーズ曼陀羅・コース一覧（`target`・`description`・レッスン数・合計所要時間付き）
- **コーストップ**: `catch`・`target`・`description`・ミニ曼陀羅・レッスン一覧（各レッスンの `description`・所要時間付き）

全体トップのヒーロー画像は `site/app/` 直下の固定ファイル名の画像（ツール埋め込み資産・静的 import）とし、正本 `images/` やコンテンツメタから取得してはならない（SHALL NOT）——画像の差し替えはファイルの置き換えで行う。`.meta.json` の `cover` フィールドはどのページでも表示に使わない（温存はするが読者向け出力に出さない）。

#### Scenario: 全体トップの構成

- **WHEN** 全体トップページを開く
- **THEN** 最上部にヒーロー画像、続いてサイト名・description・曼陀羅・シリーズ一覧が並ぶ

#### Scenario: シリーズトップの構成

- **WHEN** `catch` / `description` を持つシリーズのトップページを開く
- **THEN** ヒーローにシリーズ名・catch が表示され（画像は無い）、その下に description・曼陀羅・コース一覧が並ぶ

#### Scenario: cover を設定していても表示されない

- **WHEN** `.meta.json` に `cover` を持つシリーズのトップページを開く
- **THEN** cover 画像は表示されず、ビルドもエラーにならない

#### Scenario: コーストップのレッスン一覧

- **WHEN** 3レッスンを持つコースのトップページを開く
- **THEN** レッスンが `order` の順に、それぞれの description と所要時間つきで一覧される

### Requirement: レッスンページとパンくず

各レッスンは本文（frontmatter を除いた markdown）を描画するページとして生成されなければならない（SHALL）。frontmatter の生テキストを読者に見せてはならない（SHALL NOT）。本文中の画像プロンプト（HTML コメント）を読者向け出力に含めてはならない（SHALL NOT）。

パンくずは **Nextra 内蔵のパンくず1本だけ**を表示しなければならない（SHALL）——サイト独自のパンくず実装を持ってはならない（SHALL NOT）。レッスンページでは「シリーズ / コース / レッスン」、コーストップでは「シリーズ / コース」の形で表示され、各段は対応するページへのリンクである（SHALL）。**全体トップページにはパンくずを表示しない**（SHALL NOT）。

レッスンページの本文の上に**ラベル行**を表示しなければならない（SHALL）。並びは `{status} {所要時間} {style}` の順で、status ラベルは `done` のとき出さず、`done` 以外のとき「準備中」と表示する。style ラベルはコースの `style` から取り、日本語は「独習 / 講義 / ハンズオン」、英語は小文字の `self-study` / `lecture` / `hands-on`。未設定なら style ラベルは出さない。ラベル行の右端には `written by {author}` を表示する（`author` はレッスン frontmatter から取る。空なら出さない）。

#### Scenario: レッスン本文の描画

- **WHEN** GFM 表・コードブロック・画像・GitHub アラートを含むレッスンページを開く
- **THEN** それぞれが整形されて表示され、frontmatter と HTML コメントは表示されない

#### Scenario: パンくずが1本だけ表示される

- **WHEN** レッスンページを開く
- **THEN** パンくずは「シリーズ / コース / レッスン」の1本だけ表示され、コース名をクリックするとコーストップへ遷移する

#### Scenario: トップページにパンくずが無い

- **WHEN** 全体トップページを開く
- **THEN** パンくずは表示されない

#### Scenario: ラベル行の表示

- **WHEN** `status: done`・`estimated_minutes: 15`・コース `style: lecture`・`author: Kitamura` のレッスンページを開く
- **THEN** ラベル行に「15分」「講義」が並び（準備中は出ない）、右端に `written by Kitamura` が表示される

#### Scenario: 未完成レッスンのラベル行

- **WHEN** `status: in_progress` のレッスンページを開く
- **THEN** ラベル行の先頭に「準備中」が表示される

### Requirement: 全 status を公開し、未完成にはバッジを出す

レッスンは `status` の値によらず公開しなければならない（SHALL）。`status` が `done` 以外のレッスンには、目次（コーストップの一覧）では状態が分かるバッジ（`in_progress`=執筆中、`open`=未着手）を、レッスンページ本体ではラベル行の「準備中」を表示しなければならない（SHALL）。`done` のレッスンにはどちらの表示も出してはならない（SHALL NOT）。

#### Scenario: 執筆中レッスンの表示

- **WHEN** `status: in_progress` のレッスンをコーストップとレッスンページで見る
- **THEN** コーストップの一覧には「執筆中」バッジ、レッスンページのラベル行には「準備中」が表示される

#### Scenario: 完成レッスンには出ない

- **WHEN** `status: done` のレッスンを見る
- **THEN** 状態バッジも「準備中」も表示されない

### Requirement: supergraphic 帯

サイトの全ページは、画面最上部に高さ 6px・全幅の supergraphic 帯を表示しなければならない（SHALL）。画像はツール埋め込み資産として `site/app/` 直下（ファビコンと同じ場所）に置き、静的 import で参照しなければならない（SHALL）。正本 `images/` に置いてはならない（SHALL NOT）——正本はペイン4 の画像マネージャの管理下にあり、ユーザーが UI から削除できるため。

#### Scenario: 任意のページで帯が表示される

- **WHEN** サイトのいずれかのページを表示する
- **THEN** 画面最上部に高さ 6px・全幅の supergraphic 帯が表示される

#### Scenario: 画面幅を変えても全幅を保つ

- **WHEN** ブラウザの横幅を変更する
- **THEN** 帯は常に全幅を占め、supergraphic の色帯の横方向の並びが保たれる

