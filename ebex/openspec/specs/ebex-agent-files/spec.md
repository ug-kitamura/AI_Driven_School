# ebex-agent-files Specification

## Purpose
Agent の `@` 参照・ファイル一覧・許可パス。
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

Agent 入力欄の `@` オートコンプリートは、開いているプロジェクトフォルダ内の **全階層** のファイルを候補にしなければならない（SHALL）。候補表示にはプロジェクトルートからの相対 `path` を用いなければならない（SHALL）。いまエディタで開いているファイルがある場合、そのファイルを候補の先頭に置かなければならない（SHALL）。プロジェクトフォルダ外のファイルを候補に含めてはならない（MUST NOT）。

#### Scenario: ネストファイルが候補に出る

- **WHEN** ユーザーがプロジェクト `demo` を開き Agent 入力欄で `@` を入力する
- **THEN** `sub/notes.md` 等のネストパスが候補として表示される

#### Scenario: 開いているファイルが先頭

- **WHEN** ユーザーが `demo/sub/notes.md` を開いた状態で `@` を入力する
- **THEN** 候補の先頭が `sub/notes.md`（または同等の当該ファイル path）である

#### Scenario: フォルダ外は候補に出ない

- **WHEN** ユーザーが `@` を入力する
- **THEN** 開いているプロジェクトフォルダ外のパスは候補に含まれない

### Requirement: スキル側ファイル選定

スキルが invoke 時にフォルダ内の特定ファイルを選んで注入する UI を提供する場合、プロジェクトフォルダ配下の **再帰ファイル一覧** を表示できなければならない（SHALL）。

#### Scenario: ネストファイルのスキル選択

- **WHEN** スキルがファイル選択 UI を表示する
- **THEN** サブフォルダ内のファイルもリストに含まれる
