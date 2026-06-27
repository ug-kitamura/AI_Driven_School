# company-context-api Specification

## Purpose
TBD - created by archiving change company-context-db. Update Purpose after archive.
## Requirements
### Requirement: DB 接続確認 API

`GET /api/context/db-check` は Neon への接続可否を検証しなければならない（SHALL）。失敗時は「データベースに接続できません」を返さなければならない（SHALL）。

#### Scenario: 接続成功

- **WHEN** `DATABASE_URL` が有効である
- **AND** `GET /api/context/db-check` が呼ばれる
- **THEN** レスポンスは成功する

#### Scenario: 接続失敗

- **WHEN** `DATABASE_URL` が未設定である
- **AND** `GET /api/context/db-check` が呼ばれる
- **THEN** レスポンスは失敗する
- **AND** エラーメッセージは「データベースに接続できません」である

### Requirement: context_items CRUD API

次のエンドポイントを提供しなければならない（SHALL）:

- `GET /api/context/items` — 一覧（クエリ `tags` で OR フィルタ、省略時は全件）
- `POST /api/context/items` — 作成（`title`, `body`, `tags`, `source_url`, `source_last_updated_at` 任意）
- `GET /api/context/items/[id]` — 単体取得
- `PATCH /api/context/items/[id]` — 更新
- `DELETE /api/context/items/[id]` — 削除

`source_url` は必須でなければならない（SHALL）。作成・更新時に `updated_by` を設定しなければならない（SHALL）。

#### Scenario: タグでフィルタ一覧

- **WHEN** `GET /api/context/items?tags=環境構築,xyz` が呼ばれる
- **THEN** `tags` が `環境構築` または `xyz` を含むアイテムが JSON 配列で返される

#### Scenario: 必須フィールド不足で作成失敗

- **WHEN** `POST /api/context/items` に `source_url` が含まれない
- **THEN** レスポンスは 400 である

### Requirement: タグ一覧 API

`GET /api/context/tags` は既存 `context_items` から収集したユニークタグをアルファベット順（または日本語ロケール順）で返さなければならない（SHALL）。

#### Scenario: 既存タグを返す

- **WHEN** DB に `tags: [環境構築, xyz]` のアイテムが存在する
- **AND** `GET /api/context/tags` が呼ばれる
- **THEN** 応答に `環境構築` と `xyz` が含まれる

### Requirement: AI 整形 API

`POST /api/context/format` は貼り付けテキストを受け取り、Markdown に整形した `body` と 1〜3 個の `suggestedTags` を返さなければならない（SHALL）。リクエストには任意で既存タグ一覧を含めてよい（MAY）。system prompt は `contracts/context-format-contract.md` の規則に従わなければならない（SHALL）。Anthropic API キーは既存の AI 画像生成と同様にワークスペース設定または環境変数から解決しなければならない（SHALL）。

#### Scenario: 整形とタグ提案が返る

- **WHEN** クライアントが長文 `rawText` を `POST /api/context/format` に送信する
- **AND** AI API が成功する
- **THEN** 応答に `body`（Markdown）と `suggestedTags`（1〜3 要素の配列）が含まれる

#### Scenario: 既存タグを優先して提案

- **WHEN** リクエストに `existingTags: ["環境構築", "セキュリティ"]` が含まれる
- **AND** 内容が環境構築に該当する
- **THEN** `suggestedTags` は可能な限り `環境構築` 等の既存タグから選ばれる

