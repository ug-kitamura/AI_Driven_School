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

Agent 入力欄の `@` オートコンプリートは、開いているプロジェクトフォルダ内の **全階層** のファイルを候補にしなければならない（SHALL）。候補表示にはプロジェクトルートからの相対 `path` を用いなければならない（SHALL）。いまエディタで開いているファイルがある場合、そのファイルを候補の先頭に置かなければならない（SHALL）。プロジェクトフォルダ外のファイルを候補に含めてはならない（MUST NOT）。候補確定後の入力欄・チップ表現は「構造化ファイル添付チップ」要件に従わなければならない（SHALL）。

#### Scenario: ネストファイルが候補に出る

- **WHEN** ユーザーがプロジェクト `demo` を開き Agent 入力欄で `@` を入力する
- **THEN** `sub/notes.md` 等のネストパスが候補として表示される

#### Scenario: 開いているファイルが先頭

- **WHEN** ユーザーが `demo/sub/notes.md` を開いた状態で `@` を入力する
- **THEN** 候補の先頭が `sub/notes.md`（または同等の当該ファイル path）である

#### Scenario: フォルダ外は候補に出ない

- **WHEN** ユーザーが `@` を入力する
- **THEN** 開いているプロジェクトフォルダ外のパスは候補に含まれない

#### Scenario: 確定後はフルパストークンを本文に残さない

- **WHEN** ユーザーが候補からファイルを確定する
- **THEN** 本文に `@workspace/...` 形式のフルパストークンは挿入されない

### Requirement: 構造化ファイル添付チップ

Agent 入力で `@` からファイルを選んだとき、システムは構造化添付（`path` と `name`）をチップ配列に追加しなければならない（SHALL）。チップはアクティブスキルチップの右に紫系の見た目で並べなければならない（SHALL）。チップの表示ラベルは常にファイル名（basename）のみとし、マウスオーバーで workspace からのパスを示さなければならない（SHALL）。入力本文にはファイル名のみを挿入し、フルパスの `@workspace/...` トークンを挿入してはならない（MUST NOT）。

#### Scenario: 選択で紫チップが並ぶ

- **WHEN** ユーザーが `@` 候補から `workspace/demo/docs/notes.md` を選ぶ
- **THEN** スキルチップ列の右に表示ラベル `notes.md` の紫チップが追加され、本文には `notes.md` が挿入される

#### Scenario: hover でパス

- **WHEN** ユーザーが当該ファイルチップをマウスオーバーする
- **THEN** `demo/docs/notes.md`（workspace からのパス）が表示される

#### Scenario: 同名もファイル名のみ

- **WHEN** ユーザーが異なるパスの同名ファイルを2つ添付する
- **THEN** 両方のチップ表示はファイル名のみであり、hover でそれぞれのパスを区別できる

#### Scenario: チップ解除

- **WHEN** ユーザーがファイルチップの解除ボタンを押す
- **THEN** その添付はチップ配列から除かれ、以降の invoke 添付対象に含まれない

### Requirement: 添付解決はチップ配列が正本

Agent invoke 時、最新ユーザーメッセージの構造化添付パスを正本としてファイル内容を読み込み、モデル入力へ注入しなければならない（SHALL）。本文中の長い `@workspace/...` トークンが無くても添付できなければならない（SHALL）。

#### Scenario: 構造化添付で読込

- **WHEN** ユーザーメッセージの本文が `notes.md を要約して` であり attachments に `workspace/demo/docs/notes.md` が含まれる
- **THEN** サーバーは当該ファイルを読み込みモデル入力に含める

#### Scenario: 許可外パスは拒否

- **WHEN** attachments に `workspace/` 外または許可されないパスが含まれる
- **THEN** invoke はエラーとなりファイル内容を注入しない

### Requirement: スキル側ファイル選定

スキルが invoke 時にフォルダ内の特定ファイルを選んで注入する UI を提供する場合、プロジェクトフォルダ配下の **再帰ファイル一覧** を表示できなければならない（SHALL）。

#### Scenario: ネストファイルのスキル選択

- **WHEN** スキルがファイル選択 UI を表示する
- **THEN** サブフォルダ内のファイルもリストに含まれる
