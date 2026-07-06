# ebex-workspace-data Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: workspace 読み込み API

`GET /api/workspace/load` エンドポイントが存在し、`workspace/` 直下の全プロジェクトフォルダと各フォルダ内のファイル一覧を返さなければならない（SHALL）。`session.json` は応答に含めてはならない（MUST NOT）。サブフォルダの存在は `hasSubfolders: true` フラグで通知しなければならない（SHALL）。

#### Scenario: フォルダとファイル一覧

- **WHEN** `GET /api/workspace/load` を呼び出す
- **THEN** プロジェクトフォルダ名と各フォルダ内のファイル名リストが返される

#### Scenario: session.json 除外

- **WHEN** プロジェクトフォルダに `session.json` が存在する
- **THEN** 応答のファイル一覧に `session.json` は含まれない

### Requirement: mtime 同期 API

`GET /api/workspace/mtime` エンドポイントが存在し、workspace 全体の fingerprint を返さなければならない（SHALL）。`session.json` の変更は fingerprint に含めてはならない（MUST NOT）。

#### Scenario: fingerprint 取得

- **WHEN** `GET /api/workspace/mtime` を呼び出す
- **THEN** workspace の変更検知用 fingerprint が返される

### Requirement: フォルダ CRUD API

以下のエンドポイントが存在しなければならない（SHALL）:

- `POST /api/workspace/create-folder` — フォルダ作成
- `POST /api/workspace/rename-folder` — フォルダリネーム（`session.json` もフォルダごと移動）
- `POST /api/workspace/delete-folder` — 空フォルダのみ削除

#### Scenario: フォルダ作成

- **WHEN** `POST /api/workspace/create-folder` に `{ "name": "20260706-demo" }` を送信する
- **THEN** `workspace/20260706-demo/` が作成され HTTP 200 が返される

#### Scenario: リネーム時の session.json 移動

- **WHEN** フォルダをリネームする
- **THEN** フォルダ内の `session.json` も新フォルダ名の配下に移動される

### Requirement: ファイル CRUD API

以下のエンドポイントが存在しなければならない（SHALL）:

- `POST /api/workspace/create-file` — ファイル作成
- `POST /api/workspace/rename-file` — ファイルリネーム
- `POST /api/workspace/delete-file` — ファイル削除
- `POST /api/workspace/save-file` — ファイル内容保存

#### Scenario: ファイル保存

- **WHEN** `POST /api/workspace/save-file` にフォルダ名、ファイル名、内容を送信する
- **THEN** 対応ファイルがディスクに書き込まれ HTTP 200 が返される

### Requirement: AI フォルダ名提案 API

`POST /api/workspace/suggest-folder-name` エンドポイントが存在し、フォルダ内ファイルの内容から `{YYYYMMDD}-{slug}` 形式の名前を提案しなければならない（SHALL）。空フォルダ時は `{YYYYMMDD}-untitled` を返さなければならない（SHALL）。

#### Scenario: スラッグ提案

- **WHEN** フォルダ内に `meeting-notes.md` が存在し API を呼び出す
- **THEN** `20260706-meeting-notes` 形式の名前が提案される

### Requirement: mtime ポーリング同期

クライアントは 3 秒間隔で mtime をポーリングし、外部変更を検知した場合に workspace 状態を再読み込みしなければならない（SHALL）。`useContentSync` のパターンを `useWorkspaceSync` として流用しなければならない（SHALL）。

#### Scenario: 外部変更の反映

- **WHEN** IDE 外でファイルが変更される
- **THEN** 3 秒以内に EBEX の表示が更新される

### Requirement: 編集中保護

未保存の編集中ファイルは外部変更で上書きしてはならない（MUST NOT）。debounce 保存中（`pendingSave`）のファイルも同様に保護されなければならない（SHALL）。

#### Scenario: 編集中の保護

- **WHEN** ユーザーがファイルを編集中に外部で同ファイルが変更される
- **THEN** エディタの未保存内容は上書きされない

### Requirement: パストラバーサル防止

すべての workspace API は `folderId` / ファイル名に `..` やパス区切り文字を含む値を拒否しなければならない（SHALL）。操作対象は `workspace/` 配下に限定されなければならない（SHALL）。

#### Scenario: 不正パス拒否

- **WHEN** `folderId` に `../` を含むリクエストを送信する
- **THEN** HTTP 400 が返される

