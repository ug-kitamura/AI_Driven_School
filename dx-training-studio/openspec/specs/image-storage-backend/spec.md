# image-storage-backend Specification

## Purpose

正本画像（`images/<filename>`）の物理保存先をローカル fs または Vercel Blob（Private）で切り替えるバックエンド抽象化、API 契約、手動移行スクリプトを定義する。staging は常にローカル fs。

## Requirements

### Requirement: 正本ストレージバックエンドを抽象化する

システムは正本画像（`images/<filename>` 論理パス）の読み書き・一覧・削除について、**ローカル fs** バックエンドと **Vercel Blob（Private）** バックエンドを実装しなければならない（SHALL）。Blob 上のオブジェクトキーは論理パスと同一（例: `images/foo.png`）としなければならない（SHALL）。staging（`images/{uploaded,ai,web}/`）およびローカル `images/trash/` の操作は常にローカル fs とし、バックエンド抽象化の対象外としなければならない（SHALL）。

#### Scenario: ローカルバックエンドが正本を fs に保存する

- **WHEN** `storageMode` が `local` で promote が成功する
- **THEN** `images/<filename>` がプロジェクトルート配下の fs に存在する

#### Scenario: Blob バックエンドが正本を Blob に保存する

- **WHEN** `storageMode` が `storage` で promote が成功する
- **AND** `BLOB_READ_WRITE_TOKEN` が設定されている
- **THEN** Blob キー `images/<filename>` にオブジェクトが存在する
- **AND** fs の `images/<filename>` は作成されない

### Requirement: ストレージモードは資格情報必須とする

`storageMode` が `storage` の正本 API 呼び出しにおいて、`BLOB_READ_WRITE_TOKEN`（または将来のストレージ資格情報）が未設定または無効のとき、サーバーは **503** 等で失敗し、メッセージ **「ストレージに接続できません」** を返さなければならない（SHALL）。ローカル fs へのフォールバックを行ってはならない（MUST NOT）。

#### Scenario: トークンなしでストレージモード promote

- **WHEN** クライアントが `storageMode=storage` で promote を要求する
- **AND** `BLOB_READ_WRITE_TOKEN` が未設定である
- **THEN** レスポンスは失敗する
- **AND** エラーメッセージは「ストレージに接続できません」である

### Requirement: ストレージ接続確認 API を提供する

`GET /api/images/storage-check` は、ストレージモード用バックエンド（Vercel Blob）への接続可否を検証しなければならない（SHALL）。失敗時は「ストレージに接続できません」を返さなければならない（SHALL）。

#### Scenario: トークンありで接続確認成功

- **WHEN** `BLOB_READ_WRITE_TOKEN` が有効である
- **AND** `GET /api/images/storage-check` が呼ばれる
- **THEN** レスポンスは成功する

### Requirement: 正本 API は storageMode を受け取る

次の API は `storageMode`（`local` | `storage`）を受け取り、正本操作のバックエンド選択に用いなければならない（SHALL）:

- `POST /api/images/promote`（body）
- `GET /api/images/list?scope=used`（query）
- `GET /api/images/file`（query、正本パスのみ）
- `DELETE /api/images/file`（query、正本パスのみ）

staging パス（`images/uploaded/` 等）に対する `GET` / `DELETE` は `storageMode` を無視し、常にローカル fs を用いなければならない（SHALL）。

#### Scenario: staging file GET は storageMode 無関係

- **WHEN** `GET /api/images/file?path=images/uploaded/foo.png` が呼ばれる
- **AND** クライアントの `storageMode` が `storage` である
- **THEN** サーバーはローカル fs からファイルを返す

### Requirement: 正本の同名 promote は上書きする

正本に同一 `images/<filename>` が既に存在する場合、promote は上書きしなければならない（SHALL）。ローカルモードでは fs 上書き、ストレージモードでは Blob `put` 上書きとする。

#### Scenario: ストレージモードで同名正本を上書き promote

- **WHEN** Blob に `images/foo.png` が既に存在する
- **AND** ユーザーが staging から `foo.png` を挿入する
- **THEN** Blob 上の `images/foo.png` が新内容で置換される

### Requirement: 手動アップロードスクリプトを提供する

`scripts/upload-local-images-to-blob.mjs`（`npm run upload-images-to-blob`）を提供し、fs の `images/` 直下の正本ファイル（予約ディレクトリ `uploaded`・`ai`・`web`・`trash` を除く）を Blob キー `images/<filename>` へアップロードできなければならない（SHALL）。`--dry-run` オプションで対象ファイル一覧のみ表示できなければならない（SHALL）。

#### Scenario: dry-run で対象一覧

- **WHEN** 開発者が `node scripts/upload-local-images-to-blob.mjs --dry-run` を実行する
- **THEN** アップロード対象のファイル名が標準出力に表示される
- **AND** Blob への書き込みは行われない

#### Scenario: 正本を Blob にアップロード

- **WHEN** 開発者がスクリプトを実行する（dry-run なし）
- **AND** `images/foo.png` が fs に存在する
- **THEN** Blob キー `images/foo.png` にオブジェクトが作成される

### Requirement: v1 はローカル dev スコープとする

ストレージバックエンドの動作保証はローカル `npm run dev` に限定する（SHALL）。Vercel デプロイ環境でのストレージモード動作は v1 の対象外とする。

#### Scenario: ローカル dev でストレージモードが動作する

- **WHEN** 開発者が `.env.local` にトークンを設定し `npm run dev` で起動する
- **AND** ⚙ でストレージを選択する
- **THEN** promote・プレビュー・Used 一覧が Blob 正本で動作する
