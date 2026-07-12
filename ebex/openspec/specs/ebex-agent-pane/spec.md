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

### Requirement: 存在しないフォルダへのセッション保存を行わない

Agent セッションの保存（フォルダ切り替え時の flush および debounce 永続化）を実行する前に、システムは保存先フォルダが最新のフォルダツリー上に実在することを確認しなければならない（SHALL）。実在しないフォルダ（リネーム・削除済みの旧パス等）への保存はスキップしなければならない（SHALL）。このスキップにより、旧パスに `session.json` を含むフォルダが再生成されてはならない（MUST NOT）。

#### Scenario: リネーム直後に旧フォルダが再生成されない

- **WHEN** ユーザーがフォルダ A をフォルダ B にリネームし、リネーム前のフォルダ A に未保存の Agent セッションが存在する
- **THEN** システムはフォルダ A を再生成せず、リネーム後のフォルダ B のみがワークスペース上に存在する

#### Scenario: 通常のフォルダ切り替えではセッションが保存される

- **WHEN** ユーザーが実在するフォルダ A から実在するフォルダ C へ選択を切り替える（リネームを伴わない）
- **THEN** システムはフォルダ A のセッション内容を `session.json` として保存する

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

### Requirement: 履歴のファイル参照チップ

ユーザー／アシスタントメッセージの表示において、構造化添付および `@workspace/` 参照はファイル名のみのチップとして描画しなければならない（SHALL）。旧 `@contents/` 前提のチップ検出に依存してはならない（MUST NOT）。

#### Scenario: 構造化添付をチップ表示

- **WHEN** ユーザーメッセージに attachments として `workspace/demo/a/notes.md` が含まれる
- **THEN** 履歴上に表示ラベル `notes.md` のチップが示される

#### Scenario: 本文の @workspace トークンもチップ化

- **WHEN** 旧セッションの本文に `@workspace/demo/a/notes.md` が残っている
- **THEN** 履歴表示はそのトークンをファイル名チップとして描画する

### Requirement: /skill builtin でスキル一覧メッセージ

Agent 入力の `/` 候補に builtin コマンド `skill` を含めなければならない（SHALL）。`/skill` 実行時、システムは LLM を呼び出さず、使用可能な可視スキルの name（または id）と description の一覧を、アシスタント風メッセージとして現在セッションの履歴に1通追加して終了しなければならない（SHALL）。一覧に ebex/host などのソースラベルを付けてはならない（MUST NOT）。

#### Scenario: /skill が候補に出る

- **WHEN** ユーザーが Agent 入力欄で `/` または `/sk` を入力する
- **THEN** `skill` builtin が候補に含まれる

#### Scenario: 一覧メッセージが履歴に残る

- **WHEN** ユーザーが `/skill` を実行する
- **THEN** アシスタント役割のメッセージが1通追加され、可視スキルの名称と description が一覧される

#### Scenario: LLM を呼ばない

- **WHEN** ユーザーが `/skill` を実行する
- **THEN** Agent invoke / LLM リクエストは発生しない

#### Scenario: 一覧後に会話を続けられる

- **WHEN** `/skill` の一覧メッセージが表示されたあとユーザーが通常のメッセージを送信する
- **THEN** そのメッセージは通常の Agent 会話フローで処理される
