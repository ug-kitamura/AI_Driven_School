# ebex-workspace-ui Specification

## Purpose

TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.

## Requirements

### Requirement: 3 ペイン構成

ワークスペースは Pane 1（ファイルツリー）、Pane 2（編集+プレビュー）、Pane 3（Agent）の 3 ペインで構成されなければならない（SHALL）。Pane 1 ヘッダーには `images/logo_small.png` とツール名 **EBEX** が左から順に表示されなければならない（SHALL）。ロゴまたは「EBEX」はクリック可能であり、クリックで Purpose モーダルを開かなければならない（SHALL）。

#### Scenario: 3 ペインが同時に表示される

- **WHEN** ユーザーが EBEX を起動する
- **THEN** ファイルツリー、エディタ、Agent の 3 ペインが横並びで表示される

#### Scenario: Pane 1 にロゴと EBEX 表示

- **WHEN** ワークスペースが表示される
- **THEN** Pane 1 のヘッダーにロゴと「EBEX」が表示される

#### Scenario: ロゴまたは EBEX で Purpose を開く

- **WHEN** ユーザーが Pane 1 ヘッダーのロゴまたは「EBEX」をクリックする
- **THEN** Purpose モーダルが開く

### Requirement: ペインリサイズ

Pane 1 と Pane 3 は固定幅、Pane 2（エディタ）は残り幅を吸収する可変幅ペインとしなければならない（SHALL）。Pane 1 右のリサイズハンドルは Pane 1 幅を、Pane 2–Pane 3 間のリサイズハンドルは Pane 3（Agent）幅を変更しなければならない（SHALL）。`pane-layout.ts` は pane1 / pane2 / pane3 の 3 ペイン用に定義され、Pane 2 幅は `totalWidth - pane1 - pane3 - ハンドル幅` で算出されなければならない（SHALL）。ペイン幅（pane1 / pane3）は localStorage に永続化されなければならない（SHALL）。3 ペインの合計は常にワークスペース幅いっぱいに広がり、右端に余白を残してはならない（SHALL NOT）。pane1 の既定幅は 350px、最小幅 200px、最大幅 500px でなければならない（SHALL）。pane3 の既定幅は 700px、最小幅 400px、最大幅 1000px でなければならない（SHALL）。Pane 2 の最小幅は 400px を維持しなければならず、pane1 / pane3 を広げた結果 Pane 2 が最小幅を下回る場合は既存のフィットロジックにより pane1 / pane3 を縮小しなければならない（SHALL）。HTML プレビュー表示中であっても、Pane 2–Pane 3 間リサイズハンドルのドラッグによる幅変更は途切れてはならない（SHALL）。

#### Scenario: Pane 1 ハンドルで Pane 1 幅変更

- **WHEN** ユーザーが Pane 1 右のリサイズハンドルをドラッグする
- **THEN** Pane 1 の幅が更新され、Pane 2 が残り幅に自動調整される

#### Scenario: Pane 2–Pane 3 間ハンドルで Agent 幅変更

- **WHEN** ユーザーが Pane 2 と Pane 3 の間のリサイズハンドルをドラッグする
- **THEN** Pane 3（Agent）の幅が更新され、Pane 2 が残り幅に自動調整される

#### Scenario: HTML プレビュー中も Pane 2–Pane 3 間をリサイズできる

- **WHEN** ユーザーが `.html` ファイルをプレビュー表示した状態で Pane 2 と Pane 3 の間のリサイズハンドルをドラッグする
- **THEN** ドラッグ中も Pane 3 幅が連続的に更新され、マウスボタンを離すまでリサイズが途切れない

#### Scenario: 画面右端に余白がない

- **WHEN** ワークスペースが表示される
- **THEN** Pane 3 の右端がビューポート右端に接し、未使用の空白領域が存在しない

#### Scenario: リロード後に幅が復元される

- **WHEN** ユーザーがペイン幅を変更してページをリロードする
- **THEN** 変更後の pane1 / pane3 幅が復元され、Pane 2 は残り幅にフィットする

#### Scenario: リサイズハンドルにカーソルが変わる

- **WHEN** ユーザーがペイン間のリサイズハンドル上にマウスを置く
- **THEN** カーソルが `col-resize` に変わる

#### Scenario: 新規ユーザーの既定ペイン幅

- **WHEN** ペイン幅の localStorage が未設定のユーザーが EBEX を起動する
- **THEN** pane1 は 350px、pane3 は 700px で表示される

#### Scenario: pane1 / pane3 の最大幅

- **WHEN** ユーザーが Pane 1 のリサイズハンドルを右へ、Pane 3 のリサイズハンドルを左へ限界までドラッグする
- **THEN** pane1 は最大 500px、pane3 は最大 1000px を超えず、Pane 2 は最小幅 400px を下回らないよう調整される

### Requirement: テーマ初期化

`ThemeInitializer` により workspace-settings のテーマ設定（light / dark / system）が適用されなければならない（SHALL）。

#### Scenario: ダークテーマ適用

- **WHEN** 設定でテーマが dark に設定されている
- **THEN** ワークスペース全体がダークテーマで表示される

### Requirement: GlobalHeader の簡略化

dx-training-studio の曼陀羅ボタン、シリーズ名表示、社内コンテキストボタンは含めてはならない（MUST NOT）。設定（⚙）は Pane 2 / Pane 3 のヘッダーに配置し、GlobalHeader は使用しない（SHALL）。

#### Scenario: 曼陀羅が表示されない

- **WHEN** ワークスペースが表示される
- **THEN** 曼陀羅ボタンは存在しない

### Requirement: Tailwind ソーススキャン

`.gitignore` はデータフォルダ `ebex/workspace/` のみを除外し、`components/workspace/` を除外してはならない（MUST NOT）。Tailwind CSS は `components/workspace/` 配下の TSX からユーティリティクラス（例: `size-3`, `cursor-col-resize`）を生成しなければならない（SHALL）。

#### Scenario: gitignore がコンポーネントを除外しない

- **WHEN** `git check-ignore components/workspace/FileTreePane.tsx` を実行する
- **THEN** 当該パスは無視されない（exit code 1）

### Requirement: ペインヘッダー高さ

Pane 2 と Pane 3 のヘッダー行は `h-12`（48px）固定高さでなければならない（SHALL）。Pane 1 の EBEX タイトル行も `h-12` でなければならない（SHALL）。

#### Scenario: Pane 2/3 ヘッダー高さが揃う

- **WHEN** ワークスペースが表示される
- **THEN** Pane 2 と Pane 3 のヘッダー行の高さが同一である

### Requirement: ペイン 3 空状態の制約と誓約表示

Agent チャット（ペイン 3）の空状態（会話が未開始のセッション）では、システムは EBEX の制約と誓約の要約を表示しなければならない（SHALL）。表示は、できること（作業フォルダ内での読み書き・変換、大きな成果物の分割生成、確認のうえのスクリプト実行）と、できないこと（サブエージェント非対応→同一セッション処理、web 検索は原則しない→検索ワード提示、フォルダ外操作・削除をしない、画像の生成・読取に非対応）を含めなければならない（SHALL）。会話が開始したら当該表示は消えなければならない（SHALL）。

#### Scenario: 空状態で制約と誓約が表示される

- **WHEN** 会話が未開始のペイン 3 を表示する
- **THEN** できること・できないことを含む制約と誓約の要約が表示される

#### Scenario: 会話開始で表示が消える

- **WHEN** ユーザーが最初のメッセージを送り会話が始まる
- **THEN** 制約と誓約の要約表示は消える

### Requirement: ブラウザタブのタイトルとファヴィコン

ブラウザタブに表示されるドキュメントタイトルは `EBEX` でなければならない（SHALL）。ファヴィコンは EBEX のロゴ画像を元にしなければならず（SHALL）、ロゴの縦横比を元画像から変えてはならない（MUST NOT）。ファヴィコンは正方形のキャンバスにロゴを中央配置し、余った領域は透明の余白としなければならない（SHALL）。ファヴィコンのアセットは Next.js の app icon 規約に従い `app/icon.png` の 1 つだけとしなければならず（SHALL）、`app/favicon.ico` および `app/icon.svg` は存在してはならない（MUST NOT）。

#### Scenario: タブタイトルが EBEX

- **WHEN** ユーザーが EBEX をブラウザで開く
- **THEN** ブラウザタブのタイトルに `EBEX` が表示される

#### Scenario: ロゴの縦横比が保たれる

- **WHEN** `app/icon.png` を確認する
- **THEN** 画像は正方形であり、ロゴ部分の縦横比は元の `images/logo_small.png` と一致し、左右は透明の余白で埋められている

#### Scenario: アイコンアセットが 1 つだけ

- **WHEN** リポジトリの `app/` を確認する
- **THEN** `icon.png` のみが存在し、`favicon.ico` と `icon.svg` は存在しない

### Requirement: supergraphic バナー

画面の最上部には、ウィンドウ幅いっぱいに広がる高さ 6px の supergraphic バナーを常に表示しなければならない（SHALL）。バナーには `images/supergraphic.png` を用い、`object-fit: cover` で画像中央の帯を切り出して表示しなければならない（SHALL）。バナーは 3 ペインより上に位置し、スクロールで隠れてはならない（MUST NOT）。バナーを表示してもワークスペースの 3 ペインが縦にはみ出してはならず（MUST NOT）、ページ全体が縦スクロールしてはならない（MUST NOT）。

#### Scenario: 最上部に 6px のバナーが出る

- **WHEN** ユーザーが EBEX を開く
- **THEN** 画面最上部に高さ 6px・全幅の supergraphic バナーが表示される

#### Scenario: バナーぶんワークスペースが縮む

- **WHEN** バナーが表示されている
- **THEN** 3 ペインはバナーの下の残り高さいっぱいに収まり、ページ全体に縦スクロールバーが出ない

#### Scenario: 画像の横位置が保たれる

- **WHEN** ウィンドウ幅を変えてバナーを表示する
- **THEN** バナーは常に全幅を占め、supergraphic の色帯の横方向の並びが保たれる
