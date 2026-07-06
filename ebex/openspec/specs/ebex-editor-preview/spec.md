# ebex-editor-preview Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: 編集／プレビュー切替

Pane 2 は `PaneSegmentControl` パターンにより編集モードとプレビューモードを切り替えられなければならない（SHALL）。エディタは CodeMirror を使用しなければならない（SHALL）。

#### Scenario: 編集からプレビューへ切替

- **WHEN** ユーザーがプレビュータブを選択する
- **THEN** 現在のファイル内容がプレビュー表示される

### Requirement: プレビュー対応拡張子

以下の拡張子はプレビューを提供しなければならない（SHALL）: md（react-markdown）、html（サンドボックス iframe）、csv（表表示）、json / yml（整形表示、パースエラー時はエラー表示）、vtt（タイムスタンプ付き発話リスト、話者ラベルがあれば表示）。

#### Scenario: Markdown プレビュー

- **WHEN** ユーザーが `.md` ファイルのプレビューを表示する
- **THEN** Markdown がレンダリングされて表示される

#### Scenario: CSV 表プレビュー

- **WHEN** ユーザーが `.csv` ファイルのプレビューを表示する
- **THEN** 表形式でデータが表示される

#### Scenario: JSON パースエラー

- **WHEN** ユーザーが不正な `.json` ファイルのプレビューを表示する
- **THEN** パースエラーメッセージが表示される

#### Scenario: VTT プレビュー

- **WHEN** ユーザーが `.vtt` ファイルのプレビューを表示する
- **THEN** タイムスタンプ付きの発話リストが表示される

### Requirement: 非対応拡張子の扱い

プレビュー非対応のファイルはプレーンテキストとして扱われなければならない（SHALL）。プレビューモードでも編集画面と同じ内容が表示されなければならない（SHALL）。

#### Scenario: テキストファイルのプレビュー

- **WHEN** ユーザーが `.txt` ファイルのプレビューを表示する
- **THEN** プレーンテキストがそのまま表示される

### Requirement: Pane 2 ヘッダー

ヘッダー左にパンくず `フォルダ名 > ファイル名` が表示されなければならない（SHALL）。ヘッダー右に EBE Purpose（🍃）と設定（⚙）が配置されなければならない（SHALL）。

#### Scenario: パンくず表示

- **WHEN** ユーザーがフォルダ `demo` のファイル `notes.md` を開いている
- **THEN** ヘッダーに `demo > notes.md` が表示される

### Requirement: ファイル未選択時

ファイルが選択されていない場合、空状態メッセージが表示されなければならない（SHALL）。最後に開いたファイルのパスは localStorage に記憶し、次回起動時に復元を試みなければならない（SHALL）。

#### Scenario: 未選択時の空状態

- **WHEN** ファイルが選択されていない
- **THEN** ファイルを選択するよう促す空状態メッセージが表示される

#### Scenario: 最後のファイル復元

- **WHEN** ユーザーがファイルを開いた後にページをリロードする
- **THEN** 最後に開いていたファイルが自動的に選択される

### Requirement: 自動保存

ファイル内容の変更は debounce 後に自動保存されなければならない（SHALL）。保存失敗時はエラーメッセージが表示されなければならない（SHALL）。

#### Scenario: 編集内容の自動保存

- **WHEN** ユーザーがファイルを編集する
- **THEN** debounce 後にファイル内容がディスクに保存される

