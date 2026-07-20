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

Pane 1 と Pane 3 は固定幅、Pane 2（エディタ）は残り幅を吸収する可変幅ペインとしなければならない（SHALL）。Pane 1 右のリサイズハンドルは Pane 1 幅を、Pane 2–Pane 3 間のリサイズハンドルは Pane 3（Agent）幅を変更しなければならない（SHALL）。`pane-layout.ts` は pane1 / pane2 / pane3 の 3 ペイン用に定義され、Pane 2 幅は `totalWidth - pane1 - pane3 - ハンドル幅` で算出されなければならない（SHALL）。ペイン幅（pane1 / pane3）は localStorage に永続化されなければならない（SHALL）。3 ペインの合計は常にワークスペース幅いっぱいに広がり、右端に余白を残してはならない（SHALL NOT）。pane1 の既定幅は 300px、最小幅 200px、最大幅 400px でなければならない（SHALL）。pane3 の既定幅は 600px、最小幅 400px、最大幅 800px でなければならない（SHALL）。HTML プレビュー表示中であっても、Pane 2–Pane 3 間リサイズハンドルのドラッグによる幅変更は途切れてはならない（SHALL）。

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
- **THEN** pane1 は 300px、pane3 は 600px で表示される

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
