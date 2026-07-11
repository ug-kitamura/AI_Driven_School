# ebex-workspace-data Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: workspace 読み込み API

`GET /api/workspace/load` エンドポイントが存在し、`workspace/` 直下の全プロジェクトフォルダと **各フォルダ配下の再帰ツリー**（サブフォルダ・ファイル）を返さなければならない（SHALL）。応答の各ノードは `name`・`path`（`workspace/` からの相対フォルダパス）・`files`（直下ファイル basename 配列）・`children`（子フォルダノード配列）を含まなければならない（SHALL）。`session.json` は応答に含めてはならない（MUST NOT）。`hasSubfolders` フラグは返してはならない（MUST NOT）。

#### Scenario: 再帰ツリー応答

- **WHEN** `workspace/demo/sub/notes.md` が存在し `GET /api/workspace/load` を呼び出す
- **THEN** `demo` ノードの子に `sub` があり、`sub` の `files` に `notes.md` が含まれる

#### Scenario: session.json 除外

- **WHEN** プロジェクトフォルダに `session.json` が存在する
- **THEN** 応答のファイル一覧に `session.json` は含まれない

### Requirement: mtime 同期 API

`GET /api/workspace/mtime` エンドポイントが存在し、workspace 全体の fingerprint を返さなければならない（SHALL）。`session.json` の変更は fingerprint に含めてはならない（MUST NOT）。fingerprint はファイルの mtime に加えて、`workspace/` 配下の全フォルダの相対パス一覧（ソート済み）も入力として含めなければならない（SHALL）。

#### Scenario: fingerprint 取得

- **WHEN** `GET /api/workspace/mtime` を呼び出す
- **THEN** workspace の変更検知用 fingerprint が返される

#### Scenario: フォルダ名変更で fingerprint が変化する

- **WHEN** ファイルの mtime に変化がない状態でフォルダ名のみが変更される
- **THEN** `GET /api/workspace/mtime` が返す fingerprint は変更前と異なる値になる

#### Scenario: 空フォルダ削除で fingerprint が変化する

- **WHEN** ファイルの mtime に変化がない状態で空フォルダが削除される
- **THEN** `GET /api/workspace/mtime` が返す fingerprint は変更前と異なる値になる

### Requirement: フォルダ CRUD API

以下のエンドポイントが存在しなければならない（SHALL）:

- `POST /api/workspace/create-folder` — プロジェクトフォルダ作成（`{ name }`）またはサブフォルダ作成（`{ parentPath, name }`）。リクエスト body のパースは `parentPath` の有無に依らず `parentPath` フィールドが失われない単一スキーマで行わなければならない（SHALL）
- `POST /api/workspace/rename-folder` — フォルダリネーム（`{ fromPath, toPath }`、`session.json` はプロジェクトルート移動時のみ連動）
- `POST /api/workspace/delete-folder` — フォルダ削除（`{ folderId }`）。プロジェクトフォルダ（`folderId` に `/` を含まない）は空フォルダのみ削除可能とし、直下に `session.json` のみが存在する場合も空フォルダとみなし、`session.json` を含めてフォルダ全体を削除する。サブフォルダ（`folderId` に `/` を含む）は配下の内容に関わらず再帰削除を実行できなければならない（SHALL）
- `POST /api/workspace/move-file` — ファイル移動（`{ fromFolderId, fromName, toFolderId, toName? }`）
- `POST /api/workspace/copy-folder` — フォルダ再帰コピー（`{ fromPath, toParentPath, toName? }`）

#### Scenario: サブフォルダ作成

- **WHEN** `POST /api/workspace/create-folder` に `{ "parentPath": "demo", "name": "sub" }` を送信する
- **THEN** `workspace/demo/sub/` が作成され HTTP 200 が返される

#### Scenario: ネストパスでのリネーム

- **WHEN** `{ "fromPath": "demo/sub", "toPath": "demo/sub-renamed" }` でリネームする
- **THEN** フォルダが移動し HTTP 200 が返される

#### Scenario: 空でないプロジェクトフォルダは削除不可

- **WHEN** `session.json` 以外のサブフォルダまたはファイルを含むプロジェクトフォルダ `folderId` で削除を試みる
- **THEN** HTTP 400 が返される

#### Scenario: session.json のみのプロジェクトフォルダは削除可能

- **WHEN** `session.json` のみが存在するプロジェクトフォルダ `folderId` で `POST /api/workspace/delete-folder` を呼び出す
- **THEN** HTTP 200 が返され、`session.json` を含めてフォルダが削除される

#### Scenario: 中身ありサブフォルダの再帰削除

- **WHEN** ファイルおよび子フォルダを含む `folderId: "demo/sub"` で `POST /api/workspace/delete-folder` を呼び出す
- **THEN** HTTP 200 が返され、`demo/sub` および配下がすべて削除される

### Requirement: ファイル CRUD API

ファイル CRUD は `folderPath`（ファイルの親フォルダ相対パス）と `fileName`（basename）で操作されなければならない（SHALL）。`folderPath` はネストパス（例: `demo/sub`）を許可しなければならない（SHALL）。

#### Scenario: ネストフォルダ内ファイル保存

- **WHEN** `POST /api/workspace/save-file` に `folderPath: "demo/sub"`, `fileName: "notes.md"` を送信する
- **THEN** `workspace/demo/sub/notes.md` に書き込まれる

### Requirement: AI フォルダ名提案 API

`POST /api/workspace/suggest-folder-name` は `folderPath`（プロジェクトフォルダ ID またはネストパス）を受け取り、**当該フォルダ配下のファイル**（再帰）の内容からスラッグを提案しなければならない（SHALL）。呼び出しはプロジェクトフォルダ（`folderPath` に `/` なし）のリネーム時に限定される（SHALL）。

#### Scenario: ネストファイルを含むスラッグ提案

- **WHEN** `demo/sub/meeting.md` が存在し `folderPath: "demo"` で API を呼び出す
- **THEN** フォルダ配下の内容に基づく `{YYYYMMDD}-{slug}` が提案される

### Requirement: mtime ポーリング同期

クライアントは 3 秒間隔で mtime をポーリングし、外部変更を検知した場合に workspace 状態を再読み込みしなければならない（SHALL）。`useContentSync` のパターンを `useWorkspaceSync` として流用しなければならない（SHALL）。フォルダの追加・削除・リネームなど、ファイル mtime が変化しない外部変更も検知して再読み込みしなければならない（SHALL）。

#### Scenario: 外部変更の反映

- **WHEN** IDE 外でファイルが変更される
- **THEN** 3 秒以内に EBEX の表示が更新される

#### Scenario: 外部でのフォルダリネームが反映される

- **WHEN** IDE 外で `workspace/` 配下のフォルダ名が変更される
- **THEN** 3 秒以内に EBEX のツリー表示が新しいフォルダ名で更新される

#### Scenario: 外部での空フォルダ削除が反映される

- **WHEN** IDE 外で `session.json` のみを含む空フォルダが削除される
- **THEN** 3 秒以内に EBEX のツリー表示から当該フォルダが消える

### Requirement: 編集中保護

未保存の編集中ファイルは外部変更で上書きしてはならない（MUST NOT）。debounce 保存中（`pendingSave`）のファイルも同様に保護されなければならない（SHALL）。

#### Scenario: 編集中の保護

- **WHEN** ユーザーがファイルを編集中に外部で同ファイルが変更される
- **THEN** エディタの未保存内容は上書きされない

### Requirement: パストラバーサル防止

すべての workspace API はパスに `..` を含む値を拒否しなければならない（SHALL）。操作対象は `workspace/` 配下に `path.resolve` で限定されなければならない（SHALL）。`folderPath` は `/` 区切りの相対パスを許可しなければならない（SHALL）。

#### Scenario: 不正パス拒否

- **WHEN** `folderPath` に `../` を含むリクエストを送信する
- **THEN** HTTP 400 が返される

#### Scenario: ネストパス許可

- **WHEN** `folderPath` に `demo/sub` を指定する
- **THEN** HTTP 200 で操作が成功する

### Requirement: ファイル移動 API

`POST /api/workspace/move-file` エンドポイントが存在し、ファイルをフォルダ間で移動できなければならない（SHALL）。リクエスト body は `fromFolderId`、`fromName`、`toFolderId`、および省略可能な `toName`（省略時は `fromName` と同一）を含まなければならない（SHALL）。移動先に同名ファイルが存在する場合、HTTP 400 を返さなければならない（SHALL）。`fromFolderId` と `toFolderId` が異なるプロジェクトフォルダ（パスの第一セグメントが異なる）に属する場合も移動を許可しなければならない（SHALL）。

#### Scenario: 同一フォルダ内のリネーム相当移動

- **WHEN** `{ "fromFolderId": "demo", "fromName": "a.md", "toFolderId": "demo", "toName": "b.md" }` を送信する
- **THEN** `workspace/demo/b.md` が作成され `a.md` は削除される

#### Scenario: フォルダ間移動

- **WHEN** `{ "fromFolderId": "demo/sub", "fromName": "notes.md", "toFolderId": "demo/other" }` を送信する
- **THEN** `workspace/demo/other/notes.md` が作成され `workspace/demo/sub/notes.md` は削除される

#### Scenario: 移動先に同名ファイルがある

- **WHEN** 移動先フォルダに既に同名ファイルが存在する状態で move-file を呼び出す
- **THEN** HTTP 400 が返される

### Requirement: フォルダコピー API

`POST /api/workspace/copy-folder` エンドポイントが存在し、フォルダを再帰的にコピーできなければならない（SHALL）。リクエスト body は `fromPath`、`toParentPath`、および省略可能な `toName`（省略時は `fromPath` の最終セグメント）を含まなければならない（SHALL）。コピー先に同名フォルダが存在する場合、HTTP 400 を返さなければならない（SHALL）。`session.json` はコピーしてはならない（MUST NOT）。ドットファイルはコピーしてはならない（MUST NOT）。

#### Scenario: サブフォルダを別プロジェクトへコピー

- **WHEN** `{ "fromPath": "demo-a/sub", "toParentPath": "demo-b" }` を送信する
- **THEN** `workspace/demo-b/sub/` が `demo-a/sub/` の内容ごと作成される

#### Scenario: コピー先に同名フォルダがある

- **WHEN** `demo-b/sub` が既に存在する状態で copy-folder を呼び出す
- **THEN** HTTP 400 が返される

### Requirement: お気に入り永続化ファイル

workspace ルート（`process.cwd()` 直下）に `.ebex-favorites.json` を配置し、お気に入りデータの正本としなければならない（SHALL）。ファイル形式は `{ "favorites": [ { "folderPath": string, "fileName": string } ] }` でなければならない（SHALL）。`folderPath` は `workspace/` からの相対フォルダパス、`fileName` は basename としなければならない（SHALL）。ファイルが存在しない場合、お気に入りは空配列として扱わなければならない（SHALL）。`.ebex-favorites.json` は git 管理対象外とするため、プロジェクトの `.gitignore` に追加しなければならない（SHALL）。

#### Scenario: 初回は空のお気に入り

- **WHEN** `.ebex-favorites.json` が存在せず favorites API を呼び出す
- **THEN** 空の `favorites` 配列が返される

#### Scenario: お気に入りファイルの読み書き

- **WHEN** `{ "folderPath": "demo", "fileName": "notes.md" }` を favorites に追加する
- **THEN** `.ebex-favorites.json` に当該エントリが永続化される

### Requirement: お気に入り API

以下のエンドポイントが存在しなければならない（SHALL）:

- `GET /api/workspace/favorites` — 現在の favorites 配列を返す
- `POST /api/workspace/favorites/toggle` — `{ folderPath, fileName }` を受け取り、未登録なら追加・登録済みなら除去し、更新後の favorites 配列を返す

#### Scenario: favorites 一覧取得

- **WHEN** `GET /api/workspace/favorites` を呼び出す
- **THEN** `{ favorites: [...] }` が返される

#### Scenario: toggle でお気に入り追加

- **WHEN** 未登録の `{ folderPath: "demo", fileName: "notes.md" }` で toggle を呼び出す
- **THEN** お気に入りに追加され HTTP 200 が返される

#### Scenario: toggle でお気に入り解除

- **WHEN** 登録済みの `{ folderPath: "demo", fileName: "notes.md" }` で toggle を呼び出す
- **THEN** お気に入りから除去され HTTP 200 が返される

### Requirement: お気に入りのリネーム・削除連鎖

`POST /api/workspace/rename-file` 成功時、当該 `{ folderPath, fileName }` のお気に入りエントリが存在すれば、`fileName` を新名称に更新しなければならない（SHALL）。`POST /api/workspace/rename-folder` 成功時、`folderPath` が旧パスに一致する、または旧パス配下のお気に入りエントリの `folderPath` を新パスへ更新しなければならない（SHALL）。`POST /api/workspace/delete-file` 成功時、当該ファイルのお気に入りエントリを除去しなければならない（SHALL）。`POST /api/workspace/delete-folder` 成功時、削除対象フォルダまたはその配下に属するお気に入りエントリをすべて除去しなければならない（SHALL）。

#### Scenario: ファイルリネームでお気に入りキー更新

- **WHEN** お気に入り登録済みの `demo/notes.md` を `demo/notes-renamed.md` にリネームする
- **THEN** お気に入りは `{ folderPath: "demo", fileName: "notes-renamed.md" }` になる

#### Scenario: フォルダ削除で配下お気に入り除去

- **WHEN** `demo/sub/notes.md` がお気に入り登録済みで `demo/sub` フォルダを削除する
- **THEN** 当該お気に入りエントリが除去される

### Requirement: ファイル内容検索 API

`GET /api/workspace/search-content?q=<query>` エンドポイントが存在し、workspace 内のテキストファイル本文を再帰検索してマッチする `{ folderPath, fileName }` の配列を返さなければならない（SHALL）。`q` が空または空白のみの場合、空配列を返さなければならない（SHALL）。検索対象拡張子は `.md`, `.txt`, `.json`, `.yml`, `.yaml`, `.ts`, `.tsx`, `.js`, `.jsx`, `.html`, `.htm`, `.css`, `.xml` とし、`node_modules`、`.next`、ドット始まりディレクトリ、バイナリは走査から除外しなければならない（SHALL）。マッチ判定は大文字小文字を区別しない部分一致としなければならない（SHALL）。結果件数は最大 200 件とし、上限超過時は先頭 200 件を返し、`truncated: true` フラグを含めなければならない（SHALL）。

#### Scenario: 内容検索でマッチファイルを返す

- **WHEN** `demo/notes.md` の本文に `TODO` が含まれ、`GET /api/workspace/search-content?q=TODO` を呼び出す
- **THEN** 応答に `{ folderPath: "demo", fileName: "notes.md" }` が含まれる

#### Scenario: 空クエリは空結果

- **WHEN** `GET /api/workspace/search-content?q=` を呼び出す
- **THEN** 空配列が返される

#### Scenario: node_modules は走査しない

- **WHEN** `node_modules/pkg/readme.md` にのみクエリがマッチする
- **THEN** 応答に当該ファイルは含まれない

