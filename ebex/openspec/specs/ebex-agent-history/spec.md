# ebex-agent-history Specification

## Purpose

TBD - created by archiving change ebex-agent-history-file-primitives. Update Purpose after archive.
## Requirements
### Requirement: tool ターンの忠実な再構成

システムは、1 回の Agent invoke 内で発生した複数の tool ターンを、次の invoke へ載せる LLM メッセージ列として **時系列どおり** に再構成しなければならない（SHALL）。各ターンは「assistant の text および／または `tool_use`」とその直後の「user の `tool_result`」の対として復元しなければならない（SHALL）。最終的なアシスタント文言だけを全 `tool_use` より前に置き、複数ターンを単一の並列 `tool_use` ブロックへ潰してはならない（MUST NOT）。`read_file` 等の tool_result 本文は、再構成後も対応する `tool_use` に紐づいてモデルへ渡されなければならない（SHALL）。

#### Scenario: 確認後も読取結果が履歴に残る

- **WHEN** 先の invoke で `read_file` により文字起こしを読み、アシスタントが確認待ち文言を返し、ユーザーが「OK」と送る
- **THEN** 次 invoke の LLM メッセージ列に、当該 `read_file` の `tool_use` とその `tool_result`（本文を含む）が、確認待ち文言より前の順序で含まれる

#### Scenario: 複数ツールターンが潰されない

- **WHEN** 1 回の invoke で read → write → 確認待ち text の順に複数ターンが走る
- **THEN** 次 invoke への再構成では各ツール呼び出しが別ターンとして交互に現れ、全 tool_use が1つの assistant メッセージ末尾にまとまらない

### Requirement: UI 要約と再送用データの分離

Agent Pane 上のツール表示は要約（パス・件数・バイト数等）でよいが、次 invoke 再送に必要な `tool_result` 内容を表示要約のみに置き換えて破棄してはならない（MUST NOT）。表示用と再送用で表現が異なってもよい。

#### Scenario: UI は短く再送は本文を保持

- **WHEN** `read_file` が大きなファイルを返す
- **THEN** チャット UI は要約表示でき、かつ次 invoke の再構成では tool_result に読取内容（または切り詰め後の内容）が含まれる

### Requirement: セッション永続化失敗の通知

フォルダ単位の Agent セッション保存（localStorage 等）が容量超過などで失敗した場合、システムは失敗を黙殺してはならない（MUST NOT）。ユーザーが認識できる警告またはエラーを Agent Pane に示さなければならない（SHALL）。

#### Scenario: 保存失敗が分かる

- **WHEN** 巨大な tool_result を含むセッションの保存がストレージ上限で失敗する
- **THEN** Agent Pane に保存失敗の旨が表示される

### Requirement: 旧形式メッセージのフォールバック

論理ターン列を持たない旧形式（`toolEvents` のみ）のアシスタントメッセージは、破壊せず既存相当の再構成で処理できなければならない（SHALL）。新規保存分は忠実なターン列を優先しなければならない（SHALL）。

#### Scenario: 旧セッションが読める

- **WHEN** 旧形式の `toolEvents` のみを持つセッションでユーザーが続きのメッセージを送る
- **THEN** invoke は失敗せず、旧ロジック相当でメッセージが再構成される

### Requirement: localStorage フォールバックの ino ベースキー

サーバーへのセッション保存(`PUT /api/agent/session`)または取得(`GET /api/agent/session`)が失敗し、localStorage フォールバックへ保存・読込を行う場合、システムはフォルダ名の文字列ではなくプロジェクトの `ino` をキーとして用いなければならない(MUST)。プロジェクト名の再利用によって異なるプロジェクトの localStorage エントリが誤って引き当てられてはならない(MUST NOT)。

#### Scenario: フォールバック保存が ino をキーにする

- **WHEN** サーバーへのセッション保存が失敗し、localStorage フォールバックへ保存する
- **THEN** 保存先のキーは当該プロジェクトの `ino` であり、フォルダ名の文字列ではない

#### Scenario: 同名プロジェクトでもフォールバック履歴が引き継がれない

- **WHEN** 削除されたプロジェクトの localStorage フォールバックエントリが残っている状態で、同じ名前の新規プロジェクトのセッションをフォールバック経由で読み込む
- **THEN** 新規プロジェクトの `ino` に対応するエントリが存在しないため、旧プロジェクトの履歴は復元されない

### Requirement: 旧形式キーからの一括移行

システムは、localStorage に既存の旧形式(フォルダ名文字列キー)のエージェントチャット履歴が存在する場合、ワークスペース走査で得られる `folderId` から `ino` への対応表を用いて、新形式(`ino` キー)へ一括移行しなければならない(SHALL)。対応する `ino` が特定できない旧エントリ(既に削除されたプロジェクトのもの等)は移行対象から除外してよい。

#### Scenario: 既存の会話履歴が新形式へ引き継がれる

- **WHEN** 旧形式(フォルダ名キー)の localStorage データが存在する状態でアプリが起動し、対応するプロジェクトが現存する
- **THEN** 当該プロジェクトの会話履歴が新形式(`ino` キー)へ移行され、引き続き表示される

#### Scenario: 対応プロジェクトが存在しない旧エントリは移行されない

- **WHEN** 旧形式の localStorage エントリに対応するプロジェクトが既に削除されている
- **THEN** 当該エントリは新形式へ移行されず、破棄されてよい

