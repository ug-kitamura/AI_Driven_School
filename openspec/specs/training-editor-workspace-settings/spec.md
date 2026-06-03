# training-editor-workspace-settings Specification

## Purpose
TBD - created by archiving change pane4-ai-generation-and-settings. Update Purpose after archive.
## Requirements
### Requirement: GlobalHeader に設定入口を置く

`GlobalHeader` は DX トレーニング曼陀羅ボタンの右隣に設定ボタン（Lucide `Settings`、ghost icon）を配置しなければならない（SHALL）。クリックで設定ダイアログを開かなければならない（SHALL）。ヘッダー高さ `h-12` を維持しなければならない（SHALL）。

#### Scenario: 設定ボタンからダイアログが開く

- **WHEN** ユーザーが設定ボタンをクリックする
- **THEN** 設定ダイアログが表示される

### Requirement: Anthropic API キーをマスク入力で保存する

設定ダイアログは Anthropic API キーを password 入力（マスク表示）で編集でき、保存操作で `localStorage` の `dx-training-editor-settings` に格納しなければならない（SHALL）。サーバーはキーを永続化してはならない（MUST NOT）。クリア操作でキーを削除できなければならない（SHALL）。ダイアログにはキーがブラウザ内のみに保存される旨を表示しなければならない（SHALL）。

#### Scenario: 保存後に AI 生成が可能になる

- **WHEN** ユーザーが有効な API キーを保存する
- **AND** AI タブで生成を実行する
- **THEN** サーバー経由の Claude API 呼び出しが行われる

### Requirement: テーマをライト・ダーク・システムで切り替える

設定ダイアログはテーマとして `light`・`dark`・`system` のいずれかを選択でき、保存時に `<html>` へ `dark` class を適用または除去しなければならない（SHALL）。`system` は `prefers-color-scheme` に従わなければならない（SHALL）。設定は `dx-training-editor-settings` に永続化し、起動時に復元しなければならない（SHALL）。

#### Scenario: ダーク選択で UI が暗色になる

- **WHEN** ユーザーがテーマを `dark` に保存する
- **THEN** ワークスペース UI がダークトークンで描画される

#### Scenario: システムは OS 設定に追従する

- **WHEN** ユーザーがテーマを `system` に保存する
- **AND** OS がダークモードである
- **THEN** ワークスペース UI はダークで描画される

### Requirement: ペイン既定幅を設定できる

設定ダイアログは Pane1・Pane2・Pane4 の既定幅（px）を `pane-layout.ts` の min/max 内で編集でき、保存時に `settings.paneDefaults` へ格納しなければならない（SHALL）。「今のレイアウトに適用」は現在値をワークスペース幅 state および `dx-training-editor-pane-widths` に書き込まなければならない（SHALL）。「既定に戻す」は `paneDefaults`（未設定時はコード既定）を適用しなければならない（SHALL）。初回起動で `pane-widths` が無いときは `paneDefaults` を読み込まなければならない（SHALL）。

#### Scenario: 初回起動でカスタム既定が使われる

- **WHEN** `dx-training-editor-pane-widths` が存在しない
- **AND** ユーザーが以前 paneDefaults を 300/320/360 に保存している
- **THEN** ワークスペースはその幅で開く

### Requirement: 編集モードの CodeMirror はテーマに追従する

テーマが `dark` または `system` かつ OS がダークのとき、レッスン編集 CodeMirror はダーク向け配色で表示しなければならない（SHALL）。ライトテーマ時は現行のライト配色を用いなければならない（SHALL）。

#### Scenario: ダークテーマでエディタ背景が暗色

- **WHEN** テーマが `dark` である
- **AND** ユーザーが編集モードを開く
- **THEN** CodeMirror の背景がダーク配色である

### Requirement: Pixabay API キーをマスク入力で保存する

設定ダイアログは Pixabay API キーを password 入力（マスク表示）で編集でき、保存操作で `localStorage` の `dx-training-editor-settings` に格納しなければならない（SHALL）。サーバーはキーを永続化してはならない（MUST NOT）。クリア操作でキーを削除できなければならない（SHALL）。ダイアログにはキーがブラウザ内のみに保存される旨を表示しなければならない（SHALL）。

Web タブの検索 API 呼び出し時、クライアントは `x-pixabay-api-key` ヘッダーでキーを渡さなければならない（SHALL）。サーバーは `PIXABAY_API_KEY` 環境変数をフォールバックとして用いてよい（MAY）。

#### Scenario: 保存後に Web 検索が可能になる

- **WHEN** ユーザーが有効な Pixabay API キーを保存する
- **AND** Anthropic API キーも設定されている
- **AND** Web タブで検索を実行する
- **THEN** サーバー経由の Pixabay API 呼び出しが行われる

#### Scenario: Pixabay キー未設定で検索拒否

- **WHEN** Pixabay API キーが未設定である
- **AND** ユーザーが Web タブで検索を試みる
- **THEN** 検索 API は 401 等で失敗する
- **AND** 設定を促すメッセージが表示される

