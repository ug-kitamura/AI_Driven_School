# ebex-file-tree Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: 表示対象

Pane 1 は `workspace/` 直下の各プロジェクトフォルダと、その 1 階層下のファイルを表示しなければならない（SHALL）。`session.json` は Pane 1 に表示してはならない（MUST NOT）。OS 等で作られたサブフォルダは非表示とし、該当プロジェクトフォルダ行に ⚠ 警告アイコンを表示しなければならない（SHALL）。

#### Scenario: プロジェクトフォルダとファイルが表示される

- **WHEN** `workspace/20260706-demo/` に `notes.md` が存在する
- **THEN** Pane 1 にフォルダ `20260706-demo` とファイル `notes.md` が表示される

#### Scenario: session.json が非表示

- **WHEN** プロジェクトフォルダに `session.json` が存在する
- **THEN** Pane 1 のファイル一覧に `session.json` は表示されない

#### Scenario: サブフォルダ警告

- **WHEN** プロジェクトフォルダ内にサブフォルダが存在する
- **THEN** フォルダ行に ⚠ 警告アイコンが表示される

### Requirement: 検索フィルタ

Pane 1 上部に検索ボックスが提供されなければならない（SHALL）。キーワードにマッチするフォルダ名、または該当ファイルを含むフォルダのみが表示されなければならない（SHALL）。

#### Scenario: ファイル名でフィルタ

- **WHEN** ユーザーが検索ボックスに「notes」と入力する
- **THEN** `notes` を含むファイルを持つフォルダのみが表示される

### Requirement: フォルダ追加

下部の「フォルダを追加」からモーダルが開かれなければならない（SHALL）。モーダルにはキャンセル、追加、自動入力ボタンが提供されなければならない（SHALL）。自動入力時の名前は `{YYYYMMDD}-untitled` であり、同名存在時は `{YYYYMMDD}-untitled-{3桁通し番号}` としなければならない（SHALL）。

#### Scenario: 自動入力でフォルダ作成

- **WHEN** ユーザーが「自動入力」をクリックする
- **THEN** `20260706-untitled` 形式のフォルダが `workspace/` 配下に作成される

#### Scenario: 同名時の通し番号

- **WHEN** `20260706-untitled` が既に存在し自動入力を実行する
- **THEN** `20260706-untitled-002` 形式のフォルダが作成される

### Requirement: フォルダリネーム

フォルダ名右の編集ボタンからリネームモーダルが開かれなければならない（SHALL）。自動入力時は AI がフォルダ内ファイルの内容からスラッグ（英小文字・数字・ハイフン）を決定し `{YYYYMMDD}-{slug}` 形式の名前を提案しなければならない（SHALL）。空フォルダ時のフォールバックは `{YYYYMMDD}-untitled` でなければならない（SHALL）。

#### Scenario: 手入力リネーム

- **WHEN** ユーザーがリネームモーダルで新しい名前を入力して保存する
- **THEN** フォルダ名が更新される

#### Scenario: AI 自動入力リネーム

- **WHEN** ユーザーがリネームモーダルで「自動入力」をクリックする
- **THEN** AI が提案した `{YYYYMMDD}-{slug}` 形式の名前が入力欄にセットされる

### Requirement: フォルダ削除

削除ボタンは編集ボタンの左に配置されなければならない（SHALL）。確認ダイアログが表示されなければならない（SHALL）。直下にファイルが 1 つでも存在する場合は削除できてはならない（MUST NOT）。

#### Scenario: 空フォルダの削除

- **WHEN** ユーザーがファイルのないフォルダの削除を確認する
- **THEN** フォルダが `workspace/` から削除される

#### Scenario: ファイルありフォルダは削除不可

- **WHEN** フォルダ内に 1 つ以上のファイルが存在する
- **THEN** 削除操作は無効またはエラーとなる

### Requirement: ファイル操作

フォルダ展開時に直下ファイル一覧が表示されなければならない（SHALL）。各ファイル行には削除（左）とリネーム（右）ボタンが提供されなければならない（SHALL）。一覧最下部に「ファイルを追加」ブロックが表示されなければならない（SHALL）。DnD によるファイル追加が可能でなければならない（SHALL）。ファイル削除時は確認ダイアログが表示されなければならない（SHALL）。

#### Scenario: ファイル追加

- **WHEN** ユーザーが「ファイルを追加」をクリックする
- **THEN** 新規ファイルがプロジェクトフォルダ内に作成される

#### Scenario: DnD でファイル追加

- **WHEN** ユーザーが外部ファイルをフォルダ展開エリアにドロップする
- **THEN** ファイルがプロジェクトフォルダ内にコピーまたは作成される

#### Scenario: ファイル削除確認

- **WHEN** ユーザーがファイルの削除ボタンをクリックする
- **THEN** 確認ダイアログが表示される

