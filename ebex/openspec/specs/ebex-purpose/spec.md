# ebex-purpose Specification

## Purpose

EBE Purpose（訓示）の正本・表示・Git 管理。

## Requirements

### Requirement: purpose.md 正本

EBE Purpose の正本は `ebex/contracts/ebe-purpose.md` でなければならない（SHALL）。パス解決は appRoot（ebex の設置ディレクトリ）基準でなければならず（SHALL）、projectRoot 基準で解決してはならない（MUST NOT）。内容はクールな組織の訓示として読めるダミー 10 箇条でなければならず（SHALL）、ワークスペース機能の仕様説明リストであってはならない（MUST NOT）。各箇条は `## N. コンセプト名` 形式の見出しと、それに続く本文段落で構成されなければならない（SHALL）。旧正本 `ebex/purpose.md` は存在してはならない（MUST NOT）。

#### Scenario: 訓示ダミー同梱

- **WHEN** EBEX リポジトリを clone する
- **THEN** `ebex/contracts/ebe-purpose.md` に組織の訓示調のダミー 10 箇条が `## N. コンセプト名` ＋本文段落の形式で存在する

#### Scenario: 旧正本が残っていない

- **WHEN** EBEX リポジトリを clone する
- **THEN** `ebex/purpose.md` は存在しない

#### Scenario: ホスト配下でも ebex 側を読む

- **WHEN** projectRoot が `host`、appRoot が `host/ebex` の状態で Purpose を取得する
- **THEN** 読み込まれるのは `host/ebex/contracts/ebe-purpose.md` であり、`host/contracts/` は参照されない

### Requirement: Purpose モーダル

Pane 1 ヘッダーのロゴまたは「EBEX」タイトルをクリックすると Purpose モーダルが開かれなければならない（SHALL）。ヘッダーに `for {name}` 接尾辞が表示されている場合、その接尾辞はクリック対象に含めてはならない（MUST NOT）。モーダルはくすんだ黄色系を基調とした古文書風の見た目でなければならず（SHALL）、右上に × 閉じるボタンのみを置き、それ以外の文字は中央揃えとしなければならない（SHALL）。最上段には見出しとして文字画像 `images/typography.png` を表示しなければならない（SHALL）。その下に `contracts/ebe-purpose.md` から抽出した 10 箇条を、各項目「`N. コンセプト名`（太字）＋説明文（小さめ）」の形で順に表示しなければならない（SHALL）。本文は読み取り専用でなければならない（SHALL）。モーダルは × ボタン・Esc キー・モーダル外（背景）のクリックのいずれでも閉じられなければならない（SHALL）。閉じた状態のモーダルは画面に表示されてはならない（MUST NOT）。Pane 3 ヘッダーに Purpose 用 Leaf ボタンを置いてはならない（MUST NOT）。

#### Scenario: Pane 1 から開く

- **WHEN** ユーザーが Pane 1 ヘッダーのロゴまたは「EBEX」をクリックする
- **THEN** Purpose モーダルが表示される

#### Scenario: 接尾辞はクリックしても開かない

- **WHEN** ヘッダーが `EBEX for dx-training-studio` と表示されている状態で `for dx-training-studio` の部分をクリックする
- **THEN** Purpose モーダルは表示されない

#### Scenario: 古文書風のレイアウト

- **WHEN** Purpose モーダルが表示されている
- **THEN** 背景はくすみ黄の古文書風であり、右上に × があり、最上段に文字画像の見出しが表示され、その下にコンセプト一覧が中央揃えで表示される

#### Scenario: コンセプトが番号・名前・説明に分かれて表示される

- **WHEN** `contracts/ebe-purpose.md` に `## 1. Soil （土壌）` とその本文段落が存在する
- **THEN** モーダルには「1. Soil （土壌）」が太字で、その直下に本文が小さめの文字で表示される

#### Scenario: 3 通りの方法で閉じられる

- **WHEN** Purpose モーダルが表示されている状態で、右上の × をクリックする／Esc キーを押す／モーダル外の背景をクリックする
- **THEN** いずれの場合もモーダルが閉じ、画面から見えなくなる

#### Scenario: Pane 3 に Leaf がない

- **WHEN** Pane 3 ヘッダーが表示される
- **THEN** Purpose を開く Leaf ボタンは存在しない

#### Scenario: 読み取り専用

- **WHEN** Purpose モーダルが表示されている
- **THEN** モーダル内でテキストを編集できない

### Requirement: Git 管理

`contracts/ebe-purpose.md` は Git で管理され、IDE で編集する想定でなければならない（SHALL）。EBEX アプリ内からの編集 UI は提供しない（SHALL）。

#### Scenario: アプリ内編集なし

- **WHEN** Purpose モーダルが表示されている
- **THEN** 保存ボタンや編集フォームは存在しない

### Requirement: Purpose 抽出の部分許容

システムは `contracts/ebe-purpose.md` から `## N. コンセプト名` 形式の見出しに一致する項目のみを抽出しなければならない（SHALL）。形式に一致しない見出しや本文は静かに無視しなければならず（SHALL）、それによって抽出済みの項目の表示を妨げてはならない（MUST NOT）。抽出できた項目が 1 件も無い場合に限り、エラーメッセージを表示しなければならない（SHALL）。ファイルが読み取れない場合もエラーメッセージを表示しなければならない（SHALL）。

#### Scenario: 想定外の見出しがあっても表示できる

- **WHEN** `contracts/ebe-purpose.md` に 10 件の `## N. 名前` 見出しに加えて `## 補足` という見出しが含まれる
- **THEN** モーダルには 10 件のコンセプトが表示され、`## 補足` は表示されずエラーも出ない

#### Scenario: 1 件も抽出できないときだけエラー

- **WHEN** `contracts/ebe-purpose.md` に `## N. 名前` 形式の見出しが 1 件も存在しない
- **THEN** モーダルには解析できない旨のエラーメッセージが表示される

#### Scenario: 読み取り失敗時のエラー

- **WHEN** `contracts/ebe-purpose.md` が存在せず読み取りに失敗する
- **THEN** モーダルには読み込めない旨のエラーメッセージが表示される
