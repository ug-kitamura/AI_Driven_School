# context-local-backend Specification

## Purpose
TBD - created by archiving change context-local-storage-mode. Update Purpose after archive.
## Requirements
### Requirement: local-db ディレクトリ構成

システムはプロジェクトルート配下の `local-db/` に社内コンテキストのローカル永続化を置かなければならない（SHALL）。構成は次としなければならない（SHALL）:

- `local-db/context-meta.json` — `{ "nextId": number }`（次に採番する ID）
- `local-db/context-items/{id}.json` — 1 ファイル 1 `ContextItem`（Neon と同型フィールド）

`local-db/*` は git 追跡対象外とし、`local-db/.gitkeep` のみ追跡してよい（MAY）。

#### Scenario: 初回アクセスで store が自動作成される

- **WHEN** `contextMode` が `local` である
- **AND** `local-db/context-meta.json` が存在しない
- **THEN** `context-meta.json`（`nextId: 1`）と `context-items/` ディレクトリが作成される

#### Scenario: gitignore でデータが除外される

- **WHEN** 開発者が `local-db/context-items/1.json` を作成する
- **THEN** 当該ファイルは git の追跡対象外である

### Requirement: ローカルリポジトリで CRUD とタグ検索を提供する

`lib/context-local/repository.ts` は Neon リポジトリと同一の `ContextRepository` インターフェースで、作成・一覧・取得・更新・削除・タグ OR 検索・既存タグ一覧・全文検索を提供しなければならない（SHALL）。各 `{id}.json` は `ContextItem` 型（`id`, `title`, `body`, `tags`, `source_url`, `source_last_updated_at`, `created_by`, `updated_by`, `created_at`, `updated_at`）でなければならない（SHALL）。

#### Scenario: 新規作成で ID 採番とファイル作成

- **WHEN** ローカルリポジトリで新規アイテムを作成する
- **THEN** `context-meta.json` の `nextId` が ID として使われる
- **AND** `context-items/{id}.json` が作成される
- **AND** `nextId` が 1 増加する

#### Scenario: タイトル更新でファイル名は不変

- **WHEN** ID `42` のアイテムの `title` を更新する
- **THEN** `context-items/42.json` が上書きされる
- **AND** ファイルの rename は行われない

#### Scenario: タグ OR 検索

- **WHEN** アイテム A が `tags: ["環境構築"]`、アイテム B が `tags: ["セキュリティ"]` を持つ
- **AND** `tags=環境構築,セキュリティ` で一覧する
- **THEN** A と B の両方が返される

#### Scenario: 削除でファイルが消える

- **WHEN** ID `5` のアイテムを削除する
- **THEN** `context-items/5.json` が存在しなくなる

### Requirement: ローカル全文検索

ローカルリポジトリの `searchItems(query)` は `lib/context-search.ts` の `tokenizeSearchQuery` を用い、各アイテムの `title`・`body`・`tags`（空白結合）に対し大文字小文字を区別しない部分一致で検索しなければならない（SHALL）。結果は `updated_at DESC, id DESC` で並べなければならない（SHALL）。空クエリは空配列を返さなければならない（SHALL）。

#### Scenario: body に一致

- **WHEN** アイテム B の `body` に「ブランチ戦略」が含まれる
- **AND** `searchItems("ブランチ")` が呼ばれる
- **THEN** B が返される

#### Scenario: 空クエリ

- **WHEN** `searchItems("")` が呼ばれる
- **THEN** 空配列が返される

### Requirement: ローカル書き込みは atomic とする

`context-meta.json` および `context-items/{id}.json` への書き込みは、一時ファイルへの書き込み後に rename（または同等の atomic 操作）で置換しなければならない（SHALL）。

#### Scenario: 更新中に不完全 JSON が残らない

- **WHEN** アイテム更新の書き込みが成功する
- **THEN** `context-items/{id}.json` はパース可能な完全な JSON である

