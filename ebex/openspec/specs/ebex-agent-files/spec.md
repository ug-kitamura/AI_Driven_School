# ebex-agent-files Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: フォルダ内ファイル一覧 API

`GET /api/agent/files?folderId={name}` エンドポイントが存在し、当該プロジェクトフォルダ内のユーザーファイル（`session.json` 除外）の path と name リストを返さなければならない（SHALL）。`current` クエリパラメータで指定されたファイルを先頭に、残りを名前のアルファベット順で返さなければならない（SHALL）。

#### Scenario: フォルダ内ファイル一覧

- **WHEN** `/api/agent/files?folderId=demo` を呼び出す
- **THEN** `workspace/demo/` 内のファイル一覧が返される

#### Scenario: 選択中ファイルを先頭

- **WHEN** `/api/agent/files?folderId=demo&current=notes.md` を呼び出す
- **THEN** 応答の先頭が `notes.md` である

### Requirement: 許可パスの制限

参照可能ファイルは `workspace/<folderId>/` 配下のユーザーファイルに限定されなければならない（SHALL）。`session.json` および `workspace/` 外のパスは一覧にも invoke 添付にも含めてはならない（MUST NOT）。

#### Scenario: session.json 除外

- **WHEN** `/api/agent/files` を呼び出す
- **THEN** 応答に `session.json` は含まれない

#### Scenario: workspace 外パス拒否

- **WHEN** invoke 時に `workspace/` 外のパスが添付される
- **THEN** サーバーはそのパスを拒否する

### Requirement: @ オートコンプリート

Agent 入力欄の `@` オートコンプリートは、開いているプロジェクトフォルダ内のファイルのみを候補にしなければならない（SHALL）。

#### Scenario: フォルダ内オートコンプリート

- **WHEN** ユーザーが Agent 入力欄で `@` を入力する
- **THEN** 現在のプロジェクトフォルダ内のファイル名が候補として表示される

### Requirement: フォルダ外ファイルピッカー

`@` メニュー下部に「フォルダ外を参照…」オプションが提供されなければならない（SHALL）。選択時は OS ファイルピッカーが開かれ、選択されたファイルを invoke に添付できなければならない（SHALL）。

#### Scenario: フォルダ外参照

- **WHEN** ユーザーが「フォルダ外を参照…」を選択しファイルを選ぶ
- **THEN** 選択されたファイルが Agent invoke の添付に含まれる

### Requirement: スキル側ファイル選定

スキルは invoke 時にフォルダ内の特定ファイルを選んで注入する UI（ファイルリスト選択等）を提供できなければならない（SHALL）。フォルダ外のファイル指定も可能でなければならない（SHALL）。

#### Scenario: スキル内ファイル選択

- **WHEN** スキルがファイル選択 UI を表示する
- **THEN** プロジェクトフォルダ内のファイルがリスト表示されユーザーが選択できる

