# ebex-purpose Specification

## Purpose

EBE Purpose（訓示）の正本・表示・Git 管理。

## Requirements

### Requirement: purpose.md 正本

EBE Purpose の正本は `ebex/purpose.md` でなければならない（SHALL）。内容はクールな組織の訓示として読めるダミー 10 箇条でなければならず（SHALL）、ワークスペース機能の仕様説明リストであってはならない（MUST NOT）。

#### Scenario: 訓示ダミー同梱

- **WHEN** EBEX リポジトリを clone する
- **THEN** `ebex/purpose.md` に組織の訓示調のダミー 10 箇条が存在する

### Requirement: Purpose モーダル

Pane 1 ヘッダーのロゴまたは「EBEX」タイトルをクリックすると Purpose モーダルが開かれなければならない（SHALL）。モーダルはくすんだ黄色系を基調とした古文書風の見た目でなければならず（SHALL）、右上に × 閉じるボタンのみを置き、それ以外の文字は中央揃えとし、最上段に大きめの「EBE Purpose」を表示し、その下にやや間隔を空けて訓示 1〜10 を表示しなければならない（SHALL）。本文は `purpose.md` を Markdown レンダリングした読み取り専用でなければならない（SHALL）。Pane 3 ヘッダーに Purpose 用 Leaf ボタンを置いてはならない（MUST NOT）。

#### Scenario: Pane 1 から開く

- **WHEN** ユーザーが Pane 1 ヘッダーのロゴまたは「EBEX」をクリックする
- **THEN** Purpose モーダルが表示される

#### Scenario: 古文書風のレイアウト

- **WHEN** Purpose モーダルが表示されている
- **THEN** 背景はくすみ黄の古文書風であり、右上に × があり、タイトル「EBE Purpose」と訓示本文が中央揃えで表示される

#### Scenario: Pane 3 に Leaf がない

- **WHEN** Pane 3 ヘッダーが表示される
- **THEN** Purpose を開く Leaf ボタンは存在しない

#### Scenario: 読み取り専用

- **WHEN** Purpose モーダルが表示されている
- **THEN** モーダル内でテキストを編集できない

### Requirement: Git 管理

`purpose.md` は Git で管理され、IDE で編集する想定でなければならない（SHALL）。EBEX アプリ内からの編集 UI は提供しない（SHALL）。

#### Scenario: アプリ内編集なし

- **WHEN** Purpose モーダルが表示されている
- **THEN** 保存ボタンや編集フォームは存在しない
