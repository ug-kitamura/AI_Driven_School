# ebex-agent-files Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: フォルダ内ファイル一覧 API

`GET /api/agent/files?folderId={projectFolderId}` エンドポイントが存在し、当該 **プロジェクトフォルダ配下を再帰走査** したユーザーファイル（`session.json` 除外）の一覧を返さなければならない（SHALL）。各エントリの `path` はプロジェクトフォルダルートからの相対パス（例: `sub/notes.md`）としなければならない（SHALL）。`name` は basename としなければならない（SHALL）。`current` クエリパラメータは `path` 形式（例: `sub/notes.md`）で指定でき、一致するエントリを先頭に、残りを path の辞書順で返さなければならない（SHALL）。

#### Scenario: ネストファイルを含む一覧

- **WHEN** `workspace/demo/sub/notes.md` が存在し `/api/agent/files?folderId=demo` を呼び出す
- **THEN** 応答に `path: "sub/notes.md"` が含まれる

#### Scenario: 選択中ファイルを先頭

- **WHEN** `/api/agent/files?folderId=demo&current=sub/notes.md` を呼び出す
- **THEN** 応答の先頭が `sub/notes.md` である

### Requirement: 許可パスの制限

参照可能ファイルは `workspace/<projectFolderId>/` 配下（**全サブディレクトリを含む**）のユーザーファイルに限定されなければならない（SHALL）。`session.json` および `workspace/` 外のパスは一覧にも invoke 添付にも含めてはならない（MUST NOT）。

#### Scenario: サブフォルダ内ファイルは許可

- **WHEN** invoke 時に `demo/sub/notes.md` を添付する
- **THEN** サーバーはファイルを読み込む

### Requirement: @ オートコンプリート

Agent 入力欄の `@` オートコンプリートは、開いているプロジェクトフォルダ内の **全階層** のファイルを候補にしなければならない（SHALL）。候補表示にはプロジェクトルートからの相対 `path` を用いなければならない（SHALL）。

#### Scenario: ネストファイルが候補に出る

- **WHEN** ユーザーがプロジェクト `demo` を開き Agent 入力欄で `@` を入力する
- **THEN** `sub/notes.md` 等のネストパスが候補として表示される

### Requirement: フォルダ外ファイルピッカー

`@` メニュー下部に「フォルダ外を参照…」オプションが提供されなければならない（SHALL）。選択時は OS ファイルピッカーが開かれ、選択されたファイルを invoke に添付できなければならない（SHALL）。

#### Scenario: フォルダ外参照

- **WHEN** ユーザーが「フォルダ外を参照…」を選択しファイルを選ぶ
- **THEN** 選択されたファイルが Agent invoke の添付に含まれる

### Requirement: スキル側ファイル選定

スキルが invoke 時にフォルダ内の特定ファイルを選んで注入する UI を提供する場合、プロジェクトフォルダ配下の **再帰ファイル一覧** を表示できなければならない（SHALL）。

#### Scenario: ネストファイルのスキル選択

- **WHEN** スキルがファイル選択 UI を表示する
- **THEN** サブフォルダ内のファイルもリストに含まれる

