# ebex-agent-pane Specification

## Purpose
Pane 3 Agent ビューの表示・セッション・ヘッダー・出力反映。
## Requirements
### Requirement: Agent ビューのみ表示

Pane 3 は Agent ビューのみを表示しなければならない（SHALL）。画像マネージャー、Pane4 タブ切替は含めてはならない（MUST NOT）。ヘッダー左には現在の Agent セッション履歴名（`sessionTitle`）を表示しなければならない（SHALL）。ヘッダー右には右から順に設定ボタンと、その左隣に GitHub リポジトリ（`https://github.com/ug-kitamura/AI_Driven_School`）を新しいタブで開くボタンを配置しなければならない（SHALL）。Purpose 導線は Pane 3 に置いてはならない（MUST NOT）。

#### Scenario: Agent のみ表示

- **WHEN** ワークスペースが表示される
- **THEN** Pane 3 に Agent チャットが表示され画像タブは存在しない

#### Scenario: ヘッダーに履歴名

- **WHEN** アクティブな Agent セッションにタイトルがある
- **THEN** Pane 3 ヘッダー左にその履歴名が表示される

#### Scenario: GitHub を新しいタブで開く

- **WHEN** ユーザーが Pane 3 ヘッダーの GitHub ボタンをクリックする
- **THEN** `https://github.com/ug-kitamura/AI_Driven_School` が新しいタブで開く

#### Scenario: 設定ボタン

- **WHEN** ユーザーが Pane 3 ヘッダーの設定ボタンをクリックする
- **THEN** ワークスペース設定ダイアログが開く

### Requirement: 候補リストのスクロールバー

Agent 入力欄の `/` および `@` 選択窓の縦スクロールバーは、Pane 2 と同じ `workspace-scrollbar` デザインを用いなければならない（SHALL）。

#### Scenario: スラッシュ候補のスクロール外観

- **WHEN** `/` 候補リストが項目数により縦スクロール可能になる
- **THEN** スクロールバーの見た目は Pane 2 の `workspace-scrollbar` と一致する

#### Scenario: アットマーク候補のスクロール外観

- **WHEN** `@` 候補リストが項目数により縦スクロール可能になる
- **THEN** スクロールバーの見た目は Pane 2 の `workspace-scrollbar` と一致する

### Requirement: フォルダ単位セッション永続化

Agent 会話は選択中プロジェクトフォルダ単位で `session.json` に永続化されなければならない（SHALL）。`session.json` のスキーマは `AgentChatStorage`（`version`, `activeSessionId`, `sessions`）でなければならない（SHALL）。`GET /api/agent/session?folderId={name}` および `PUT /api/agent/session?folderId={name}` で読み書きしなければならない（SHALL）。

#### Scenario: session.json から読み込み

- **WHEN** プロジェクトフォルダに `session.json` が存在しユーザーがそのフォルダを選択する
- **THEN** 保存済みの Agent 会話が復元される

#### Scenario: session.json への保存

- **WHEN** ユーザーが Agent と会話する
- **THEN** debounce 後に `session.json` が更新される

### Requirement: FS 不可時の localStorage フォールバック

`PUT /api/agent/session` が FS 書き込み不可で失敗した場合、クライアントは `localStorage` キー `ebex-agent-chat-v2` 内の当該 `folderId` に保存しなければならない（SHALL）。

#### Scenario: API 失敗時のフォールバック

- **WHEN** `PUT /api/agent/session` が 501 を返す
- **THEN** クライアントは localStorage にセッションを保存し致命的エラーを表示しない

### Requirement: 入力スコープ

Agent invoke 時の既定入力スコープは選択中プロジェクトフォルダ内でなければならない（SHALL）。フォルダ内の全ファイルを自動注入してはならない（MUST NOT）。どのファイルを使用するかはスキル側で定義されなければならない（SHALL）。

#### Scenario: 自動全ファイル注入なし

- **WHEN** ユーザーが特別な指定なく Agent を invoke する
- **THEN** フォルダ内の全ファイルが自動的に添付されない

### Requirement: チャット出力のエディタ反映

チャットのみの出力時、ユーザはコピーボタンまたはエディタ上書きボタンで Pane 2 のエディタに内容を反映できなければならない（SHALL）。

#### Scenario: エディタ上書き

- **WHEN** ユーザーがアシスタントメッセージのエディタ上書きボタンをクリックする
- **THEN** 現在開いているファイルの内容がメッセージ内容で置き換わる

### Requirement: スキル出力のファイル書き込み

スキルがファイル出力を指示した場合、出力は同一プロジェクトフォルダ内に直接書き込まれなければならない（SHALL）。同名ファイルが存在する場合、スキル frontmatter の `on_conflict`（`confirm` / `overwrite` / `skip`、デフォルト `confirm`）に従わなければならない（SHALL）。

#### Scenario: 同名ファイルの確認

- **WHEN** スキルが既存ファイルと同名の出力を指示し `on_conflict` が `confirm` である
- **THEN** ユーザーに上書き確認ダイアログが表示される

#### Scenario: 上書き

- **WHEN** スキルの `on_conflict` が `overwrite` である
- **THEN** 確認なしでファイルが上書きされる
