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
- `POST /api/workspace/delete-folder` — 空フォルダのみ削除（`{ folderPath }`）。フォルダ直下に `session.json` のみが存在する場合も空フォルダとみなし、削除時は `session.json` を含めてフォルダ全体を削除する

#### Scenario: サブフォルダ作成

- **WHEN** `POST /api/workspace/create-folder` に `{ "parentPath": "demo", "name": "sub" }` を送信する
- **THEN** `workspace/demo/sub/` が作成され HTTP 200 が返される

#### Scenario: ネストパスでのリネーム

- **WHEN** `{ "fromPath": "demo/sub", "toPath": "demo/sub-renamed" }` でリネームする
- **THEN** フォルダが移動し HTTP 200 が返される

#### Scenario: 空でないフォルダは削除不可

- **WHEN** `session.json` 以外のサブフォルダまたはファイルを含む `folderPath` で削除を試みる
- **THEN** HTTP 400 が返される

#### Scenario: session.json のみのフォルダは削除可能

- **WHEN** `session.json` のみが存在する `folderPath` で `POST /api/workspace/delete-folder` を呼び出す
- **THEN** HTTP 200 が返され、`session.json` を含めてフォルダが削除される

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

