# company-context-dialog Specification

## Purpose

GlobalHeader から開く社内コンテキスト管理ダイアログ（一覧・CRUD・タグ入力・鮮度アラート・AI 整形）の UI 要件を定義する。
## Requirements
### Requirement: GlobalHeader から社内コンテキストダイアログを開く

`GlobalHeader` に「社内コンテキスト」ボタンが存在し、クリックで管理ダイアログを開かなければならない（SHALL）。配置は DX トレーニング曼陀羅ボタンと設定ボタンの間でなければならない（SHALL）。

#### Scenario: ボタンからダイアログを開く

- **WHEN** ユーザーが GlobalHeader の「社内コンテキスト」をクリックする
- **THEN** 社内コンテキスト管理ダイアログが表示される

### Requirement: 社内コンテキストの CRUD UI

管理ダイアログは `context_items` の一覧表示・新規作成・編集・削除を提供しなければならない（SHALL）。各アイテムのフィールドは `title`, `body`（Markdown）, `tags`, `source_url`（必須）, `source_last_updated_at`（任意）でなければならない（SHALL）。UI パターンは `MetaDialogField` と shadcn の `Dialog` を用い、既存のメタ編集ダイアログに倣わなければならない（SHALL）。

#### Scenario: 新規アイテムを保存する

- **WHEN** ユーザーが必須フィールドを入力して保存する
- **THEN** `POST /api/context/items` が呼ばれ一覧が更新される

#### Scenario: source_url 未入力で保存不可

- **WHEN** ユーザーが `source_url` を空のまま保存しようとする
- **THEN** バリデーションエラーが表示される

### Requirement: タグ入力は補完とインライン追加

タグ入力 UI は既存タグ（`GET /api/context/tags`）のオートコンプリートと、新規タグのインライン追加を両方サポートしなければならない（SHALL）。1 アイテムに複数タグを付与できなければならない（SHALL）。

#### Scenario: 既存タグから選択

- **WHEN** ユーザーがタグ入力欄で文字を入力する
- **AND** 既存タグに一致するものがある
- **THEN** 候補が表示され選択できる

#### Scenario: 新規タグを追加

- **WHEN** ユーザーが未登録のタグ名を入力して確定する
- **THEN** そのタグがアイテムの `tags` に追加される

### Requirement: 鮮度アラートとフィルタ

`source_last_updated_at` が未入力、または現在日から 1 年以上前のアイテムには一覧でアラート表示しなければならない（SHALL）。「原典更新日が古い・未入力」で一覧をフィルタできなければならない（SHALL）。

#### Scenario: 1 年超でアラート

- **WHEN** アイテムの `source_last_updated_at` が 400 日以上前である
- **THEN** 一覧で鮮度アラートが表示される

#### Scenario: 未入力でアラート

- **WHEN** アイテムの `source_last_updated_at` が NULL である
- **THEN** 一覧で鮮度アラートが表示される

### Requirement: AI整形ボタン

作成・編集フォームに **「AI整形」** ボタンを配置しなければならない（SHALL）。クリック時、現在の `body` 欄のテキスト（貼り付け長文を想定）を `POST /api/context/format` に送り、返却された `body` で欄を置換し、`suggestedTags` をタグ欄に提案（ユーザーが確認・編集可能）しなければならない（SHALL）。ボタンにはツールチップで「要約・タグ提案・Markdown 整形」を示してよい（MAY）。

#### Scenario: AI整形で body とタグが更新される

- **WHEN** ユーザーが長文を body に貼り付け「AI整形」をクリックする
- **AND** API が成功する
- **THEN** body 欄が整形済み Markdown に置換される
- **AND** タグ欄に 1〜3 個の提案タグが表示される

#### Scenario: DB 未接続時

- **WHEN** `DATABASE_URL` が未設定で AI整形以外の保存を試みる
- **THEN** 接続エラーメッセージが表示される

