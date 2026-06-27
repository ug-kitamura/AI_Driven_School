# context-db-backend Specification

## Purpose

Neon PostgreSQL 上の `context_items` テーブル、接続解決（`DATABASE_URL`）、リポジトリ層 CRUD・タグ OR 検索、マイグレーション SQL を定義する。`@neondatabase/serverless` による App Router 向け DB アクセスを含む。
## Requirements
### Requirement: context_items テーブルスキーマ

システムは Vercel Neon 上に `context_items` テーブルを作成しなければならない（SHALL）。カラムは次を含まなければならない（SHALL）: `id SERIAL PRIMARY KEY`, `title TEXT NOT NULL`, `body TEXT NOT NULL`, `tags TEXT[] NOT NULL DEFAULT '{}'`, `source_url TEXT NOT NULL`, `source_last_updated_at DATE`, `created_by TEXT`, `updated_by TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`。`tags` 列には GIN インデックスを作成しなければならない（SHALL）。

#### Scenario: マイグレーション SQL がスキーマを定義する

- **WHEN** 開発者が `lib/context-db/migrate.sql` を Neon に適用する
- **THEN** `context_items` テーブルと `idx_context_items_tags` GIN インデックスが存在する

### Requirement: Neon 接続の解決

システムは `DATABASE_URL` 環境変数から Neon 接続を解決しなければならない（SHALL）。未設定または接続不可のときは `DbConnectionError`（または同等）を送出し、メッセージ **「データベースに接続できません」** としなければならない（SHALL）。ローカルファイルやインメモリへのフォールバックを行ってはならない（MUST NOT）。

#### Scenario: DATABASE_URL 未設定

- **WHEN** `DATABASE_URL` が未設定である
- **AND** リポジトリ層が呼び出される
- **THEN** 接続エラーが送出される
- **AND** エラーメッセージは「データベースに接続できません」である

### Requirement: リポジトリ層で CRUD とタグ検索を提供する

`lib/context-db/repository.ts` は `context_items` の作成・一覧・取得・更新・削除およびタグ OR 検索（`tags &&`）・既存タグ一覧（`DISTINCT unnest(tags)`）を提供しなければならない（SHALL）。`body` は Markdown 文字列として保存しなければならない（SHALL）。

#### Scenario: タグ OR 検索で複数ヒット

- **WHEN** アイテム A が `tags: [環境構築]`、アイテム B が `tags: [セキュリティ]` を持つ
- **AND** `tags=環境構築,セキュリティ` で検索する
- **THEN** A と B の両方が返される

#### Scenario: created_by が取得できない

- **WHEN** サーバーが `os.userInfo().username` を取得できない
- **AND** 新規アイテムを作成する
- **THEN** `created_by` は NULL または空として保存される

### Requirement: v1 はローカル dev スコープ

`context-db-backend` の動作保証はローカル `npm run dev` に限定する（SHALL）。Vercel デプロイ環境での DB 動作は v1 の対象外とする。

#### Scenario: ローカル dev で DB 接続が動作する

- **WHEN** 開発者が `.env.local` に `DATABASE_URL` を設定し `npm run dev` で起動する
- **THEN** リポジトリ層が Neon に接続できる

### Requirement: title と body の ILIKE 検索

`lib/context-db/repository.ts` は `searchItems(query: string)` を提供し、`title ILIKE %query% OR body ILIKE %query%` で部分一致検索しなければならない（SHALL）。結果は `updated_at DESC, id DESC` で並べなければならない（SHALL）。`query` が空文字の場合は空配列を返さなければならない（SHALL）。

#### Scenario: title に一致

- **WHEN** アイテム A の `title` が「環境構築手順」である
- **AND** `searchItems("環境")` が呼ばれる
- **THEN** A が返される

#### Scenario: body に一致

- **WHEN** アイテム B の `body` に「ブランチ戦略」が含まれる
- **AND** `searchItems("ブランチ")` が呼ばれる
- **THEN** B が返される

#### Scenario: 空クエリ

- **WHEN** `searchItems("")` が呼ばれる
- **THEN** 空配列が返される

