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

Agent 会話は選択中プロジェクトフォルダ単位で `workspace/.meta/sessions/<ino>.json` に永続化されなければならない（SHALL）。`<ino>` は対象フォルダの NTFS fileID（`workspace-meta-store` の台帳が管理）である。セッションファイルのスキーマは `AgentChatStorage`（`version`, `activeSessionId`, `sessions`）でなければならない（SHALL）。`GET /api/agent/session?folderId={name}` および `PUT /api/agent/session?folderId={name}` で読み書きしなければならない（SHALL）。API の folderId はフォルダパスのままとし、ino への解決はサーバ内部で行う。プロジェクトフォルダ内に `session.json` を作成してはならない（MUST NOT）。

#### Scenario: セッションファイルから読み込み

- **WHEN** プロジェクトフォルダに対応する `.meta/sessions/<ino>.json` が存在しユーザーがそのフォルダを選択する
- **THEN** 保存済みの Agent 会話が復元される

#### Scenario: セッションファイルへの保存

- **WHEN** ユーザーが Agent と会話する
- **THEN** debounce 後に `.meta/sessions/<ino>.json` が更新され、プロジェクトフォルダ内にファイルは作成されない

#### Scenario: リネームを跨ぐセッション維持

- **WHEN** ユーザーがプロジェクトフォルダをリネームした後にそのフォルダを選択する
- **THEN** ino が不変のため同一のセッションファイルが読み込まれ、会話履歴が維持される

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

スキルがファイル出力を指示した場合、出力は同一プロジェクトフォルダ内に直接書き込まれなければならない（SHALL）。同名ファイルが存在する場合、EBEX ランタイムは常に上書き確認を強制しなければならない（SHALL）。スキル frontmatter に `on_conflict`（`confirm` / `overwrite` / `skip`）が指定されていても、その値は無視してよい（MAY）。ランタイムはユーザーの同意を得たあとにのみ上書きを行わなければならない（SHALL）。

#### Scenario: 同名ファイルは常に確認

- **WHEN** スキルが既存ファイルと同名の出力を指示する
- **THEN** frontmatter の `on_conflict` の値に関わらずユーザーに上書き確認ダイアログが表示される

#### Scenario: 同意後に上書き

- **WHEN** ユーザーが上書き確認ダイアログで同意する
- **THEN** 既存ファイルが新しい内容で上書きされる

#### Scenario: 拒否時は上書きしない

- **WHEN** ユーザーが上書き確認ダイアログで拒否する
- **THEN** 既存ファイルは変更されない

#### Scenario: on_conflict: overwrite は無視される

- **WHEN** スキルの frontmatter が `on_conflict: overwrite` を指定している
- **THEN** それでも確認なしでは上書きされず、ランタイムの確認ダイアログが表示される

### Requirement: 履歴のファイル参照チップ

ユーザー／アシスタントメッセージの表示において、構造化添付および `@workspace/` 参照はファイル名のみのチップとして描画しなければならない（SHALL）。旧 `@contents/` 前提のチップ検出に依存してはならない（MUST NOT）。

#### Scenario: 構造化添付をチップ表示

- **WHEN** ユーザーメッセージに attachments として `workspace/demo/a/notes.md` が含まれる
- **THEN** 履歴上に表示ラベル `notes.md` のチップが示される

#### Scenario: 本文の @workspace トークンもチップ化

- **WHEN** 旧セッションの本文に `@workspace/demo/a/notes.md` が残っている
- **THEN** 履歴表示はそのトークンをファイル名チップとして描画する

### Requirement: /skill builtin でスキル一覧メッセージ

Agent 入力の `/` 候補に builtin コマンド `skill` を含めなければならない（SHALL）。`/skill` 実行時、システムは LLM を呼び出さず、使用可能な可視スキルの name（または id）と description の一覧を、アシスタント風メッセージとして現在セッションの履歴に1通追加して終了しなければならない（SHALL）。一覧は Markdown の表形式（スキル列・説明列）でよいが、各スキルは表の **1 行** に収まらなければならない（SHALL）。description に含まれる改行（`\n` / `\r` / CRLF）およびセル区切りを壊す文字は、表セル用に正規化またはエスケープしなければならない（SHALL）。一覧に ebex/host などのソースラベルを付けてはならない（MUST NOT）。

#### Scenario: /skill が候補に出る

- **WHEN** ユーザーが Agent 入力欄で `/` または `/sk` を入力する
- **THEN** `skill` builtin が候補に含まれる

#### Scenario: 一覧メッセージが履歴に残る

- **WHEN** ユーザーが `/skill` を実行する
- **THEN** アシスタント役割のメッセージが1通追加され、可視スキルの名称と description が一覧される

#### Scenario: 複数行 description でも表が割れない

- **WHEN** 可視スキルの description が YAML `|` 由来の複数行（CRLF を含む）である
- **THEN** カタログ表ではそのスキルが1行に表示され、説明列に description の内容が続き、次行のスキル列へ説明文がはみ出さない

#### Scenario: LLM を呼ばない

- **WHEN** ユーザーが `/skill` を実行する
- **THEN** Agent invoke / LLM リクエストは発生しない

#### Scenario: 一覧後に会話を続けられる

- **WHEN** `/skill` の一覧メッセージが表示されたあとユーザーが通常のメッセージを送信する
- **THEN** そのメッセージは通常の Agent 会話フローで処理される

### Requirement: /summary builtin で会話要約

Agent 入力の `/` 候補に builtin コマンド `summary` を含めなければならない（SHALL）。`/summary` 実行時、システムは固定の要約指示文を通常のユーザーメッセージとして既存の Agent 送信経路で送信しなければならない（SHALL）。要約はこれまでの当該セッションのやり取りを対象とし、アシスタントメッセージとして Markdown 表示されなければならない（SHALL）。要約の実行によってワークスペースへのファイル書き込みを行ってはならない（MUST NOT）。指示文にはファイルへ書き込まない旨を含めなければならない（SHALL）。スキルカタログ（可視・hidden を問わず）へ summary スキルを追加してはならない（MUST NOT）。

#### Scenario: /summary が候補に出る

- **WHEN** ユーザーが Agent 入力欄で `/` または `/su` を入力する
- **THEN** `summary` builtin が候補に含まれる

#### Scenario: 要約がチャットに表示される

- **WHEN** 数往復の会話があるセッションでユーザーが `/summary` を実行する
- **THEN** 固定の要約指示がユーザーメッセージとして送信され、これまでのやり取りの要約が Markdown のアシスタントメッセージとして表示される

#### Scenario: ファイルは作成されない

- **WHEN** ユーザーが `/summary` を実行し要約が表示される
- **THEN** プロジェクトフォルダ内に新規ファイルは作成されない

#### Scenario: 要約後に会話を続けられる

- **WHEN** 要約表示後にユーザーが通常のメッセージを送信する
- **THEN** そのメッセージは通常の Agent 会話フローで処理される

### Requirement: ツール実行折りたたみタイトルの短縮

ツール実行の折りたたみブロックのタイトルは、内包するツール件数に比例して長くなってはならない（MUST NOT）。未完了のツールがある間は、最新のツールの表示名 1 件に実行中である旨（例: `読取: purpose.md を実行中…`）を表示しなければならない（SHALL）。全ツール完了後は、件数と動詞の集計（例: `ツール実行 5件（読取 ×3・作成・書込）`）を表示しなければならない（SHALL）。タイトル要素には CSS の truncate を適用し、横スクロールを発生させてはならない（MUST NOT）。展開後の詳細表示（各ツールの display・result 等）は従来のまま変更してはならない（MUST NOT）。

#### Scenario: 実行中は最新ツールのみ

- **WHEN** Agent が 3 件目のツール `作成: output` を実行中である
- **THEN** 折りたたみタイトルには最新ツールの表示名と実行中である旨のみが表示され、完了済みツールの連結は表示されない

#### Scenario: 完了後は件数と動詞集計

- **WHEN** 読取 3 件・作成 1 件・書込 1 件のツール実行がすべて完了する
- **THEN** 折りたたみタイトルは `ツール実行 5件（読取 ×3・作成・書込）` の形式になる

#### Scenario: 横スクロールが発生しない

- **WHEN** 多数のツール実行を含むブロックが折りたたみ表示される
- **THEN** タイトルは表示幅に収まり（超過分は省略記号）、メッセージ領域に横スクロールは発生しない

#### Scenario: 展開表示は従来どおり

- **WHEN** ユーザーが折りたたみブロックを展開する
- **THEN** 各ツールの詳細（display・query・result 等）が従来どおり全件表示される

### Requirement: ストリーミング中の本文末尾スピナー

アシスタントメッセージのストリーミング中、システムは当該メッセージ本文の直後（最終行の次の行頭）にスピナーを表示しなければならない（SHALL）。スピナーは本文の Markdown ソースに文字を挿入する方式であってはならない（MUST NOT）。ストリーミング終了時にスピナーは消えなければならない（SHALL）。ストリーミング中でないメッセージにスピナーを表示してはならない（MUST NOT）。

#### Scenario: 応答中は本文末尾にスピナー

- **WHEN** Agent が応答をストリーミング中である
- **THEN** 生成済み本文の直後の行頭にスピナーが表示される

#### Scenario: 完了でスピナーが消える

- **WHEN** ストリーミングが完了する
- **THEN** 本文末尾のスピナーは表示されなくなる

#### Scenario: 過去メッセージにはスピナーがない

- **WHEN** ストリーミング中に過去のアシスタントメッセージを表示する
- **THEN** 過去メッセージの末尾にスピナーは表示されない

### Requirement: サブエージェント非対応のユーザー表示

スキル実行開始時に「サブエージェント」キーワードが検出された場合、Agent Pane（チャットまたは同等の目立つ UI）に、EBEX がサブエージェント非対応であることと同一セッションで続行する旨を表示しなければならない（SHALL）。この表示は実行中止の確認ダイアログであってはならない（MUST NOT）。

#### Scenario: チャットまたはバナーに案内が出る

- **WHEN** 「サブエージェント」を含むスキルの実行が開始される
- **THEN** Agent Pane 上に非対応と同一セッション続行の案内が表示される

### Requirement: 実行中状態をワークスペースへ公開する

Agent がストリーミング実行中であるかどうかと、その実行対象のプロジェクトフォルダ ID を、ワークスペース（少なくとも File Tree）が参照できる形で公開しなければならない（SHALL）。実行が完了・中断・失敗したときは、実行中でなくなったことを反映しなければならない（SHALL）。

#### Scenario: 実行中フラグが共有される

- **WHEN** ユーザーがプロジェクトフォルダ A で Agent を実行中である
- **THEN** ワークスペースは「フォルダ A が Agent 実行中」であることを File Tree 側で利用できる

#### Scenario: 終了後は実行中でなくなる

- **WHEN** Agent のストリーミングが完了または中断する
- **THEN** ワークスペース上の当該フォルダの実行中状態は解除される

### Requirement: 確認要求イベントの非破棄

クライアントのストリーム消費層（`consumeAgentStream` 相当）は、サーバが定義するすべての `ConfirmKind` の `confirm_required` イベントを確認ダイアログへ転送できなければならない（SHALL）。受理する kind の一覧はサーバ定義と単一の共有定数から導出しなければならず（SHALL）、リテラル列挙の重複によって乖離が生じる構造にしてはならない（MUST NOT）。サーバとクライアントの kind 一覧の一致は自動テストで検証されなければならない（SHALL）。クライアントが解釈できない未知の kind を受信した場合、イベントを黙って破棄してはならず（MUST NOT）、`POST /api/agent/tool-confirm` へ即時に拒否応答を送信してサーバ側の確認待ちを解放しなければならない（SHALL）。

#### Scenario: 全 ConfirmKind がダイアログへ到達する

- **WHEN** サーバ定義の各 `ConfirmKind`（`overwrite` / `outside-project-read` / `outside-project-write` / `run-script` / `run-skill-script` / `generate-write` / `web-search`）で `confirm_required` イベントが届く
- **THEN** すべての kind で `onConfirmRequired` が呼び出され、対応するダイアログ表示が可能である

#### Scenario: kind 一覧の乖離をテストが検出する

- **WHEN** サーバ側に新しい `ConfirmKind` が追加され、クライアント側の受理処理が未対応のままである
- **THEN** kind パリティを検証する自動テストが失敗する

#### Scenario: 未知 kind は即時拒否でサーバを解放する

- **WHEN** クライアントが解釈できない kind の `confirm_required` イベントを受信する
- **THEN** イベントは黙殺されず、拒否応答が即時にサーバへ送信され、確認待ちがタイムアウト（5 分）まで放置されることはない
