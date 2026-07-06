# ebex-purpose Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: purpose.md 正本

EBE Purpose の正本は `ebex/purpose.md` でなければならない（SHALL）。開発用のダミー 10 箇条が同梱されなければならない（SHALL）。

#### Scenario: ダミー同梱

- **WHEN** EBEX リポジトリを clone する
- **THEN** `ebex/purpose.md` に 10 箇条のダミーコンテンツが存在する

### Requirement: Purpose モーダル

Pane 2 / Pane 3 ヘッダーの 🍃「EBE Purpose」クリックで大きめのモーダルが開かれなければならない（SHALL）。モーダル内は `purpose.md` を Markdown レンダリングして読み取り専用で表示しなければならない（SHALL）。

#### Scenario: モーダル表示

- **WHEN** ユーザーが 🍃 EBE Purpose をクリックする
- **THEN** `purpose.md` の内容が Markdown レンダリングされたモーダルが表示される

#### Scenario: 読み取り専用

- **WHEN** Purpose モーダルが表示されている
- **THEN** モーダル内でテキストを編集できない

### Requirement: Git 管理

`purpose.md` は Git で管理され、IDE で編集する想定でなければならない（SHALL）。EBEX アプリ内からの編集 UI は提供しない（SHALL）。

#### Scenario: アプリ内編集なし

- **WHEN** Purpose モーダルが表示されている
- **THEN** 保存ボタンや編集フォームは存在しない

