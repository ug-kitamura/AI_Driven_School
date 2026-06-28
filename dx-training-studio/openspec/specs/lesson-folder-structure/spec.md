# lesson-folder-structure Specification

## Purpose
TBD - created by archiving change lesson-folder-agent-sessions. Update Purpose after archive.
## Requirements
### Requirement: レッスンフォルダ構成

各レッスンは `contents/{series}/{course}/{lessonName}/` フォルダとして存在しなければならない（SHALL）。フォルダ名はレッスン表示名（`sanitizeFilename()` 適用済み）と一致しなければならない（SHALL）。フォルダ内の本文ファイルは `contents.md` でなければならない（SHALL）。Phase 1 では `contents.md` に YAML フロントマターと Markdown 本文の両方を含めなければならない（SHALL）。

#### Scenario: レッスンフォルダから本文を読み込む

- **WHEN** `contents/はじめにシリーズ/DX piyopiyo コース/トレーニングの進め方/contents.md` が存在する
- **THEN** `loadContentsFolder()` は当該レッスンの `content` にファイル全文を設定する

#### Scenario: レッスンフォルダが存在しない場合

- **WHEN** コース `.meta.json` の `order` にレッスン名が含まれるが対応フォルダが存在しない
- **THEN** 当該レッスンはロード結果から除外される

### Requirement: session.json の配置

各レッスンフォルダは Agent 会話用の `session.json` を持てなければならない（MAY）。`session.json` は Git 追跡対象外でなければならない（SHALL）（`.gitignore` に `contents/**/session.json`）。

#### Scenario: session.json が gitignore される

- **WHEN** レッスンフォルダに `session.json` が存在する
- **THEN** Git リポジトリには当該ファイルがコミットされない

### Requirement: レッスン create API はフォルダを作成する

`POST /api/content/create` でレッスンを作成する場合、コース直下に `{lessonName}/contents.md` を作成しなければならない（SHALL）。コース `.meta.json` の `order` 末尾にレッスン名を追加しなければならない（SHALL）。

#### Scenario: 新規レッスン作成

- **WHEN** ユーザーがコース内にレッスン「新レッスン」を作成する
- **THEN** `contents/{series}/{course}/新レッスン/contents.md` が作成される
- **AND** コース `.meta.json` の `order` 末尾に `新レッスン` が追加される

### Requirement: レッスン rename API はフォルダを rename する

`POST /api/content/rename` でレッスンをリネームする場合、レッスンフォルダ全体を rename し、コース `.meta.json` の `order` 内の名前を更新しなければならない（SHALL）。`session.json` が存在する場合はフォルダごと移動されなければならない（SHALL）。

#### Scenario: レッスンフォルダのリネーム

- **WHEN** レッスン「旧名」を「新名」にリネームする
- **THEN** フォルダ `旧名/` が `新名/` に rename される
- **AND** `新名/contents.md` および `新名/session.json`（存在する場合）が保持される

### Requirement: レッスン delete API はフォルダを削除する

`POST /api/content/delete` でレッスンを削除する場合、レッスンフォルダ全体（`contents.md`、`session.json` 含む）を削除し、コース `.meta.json` の `order` から当該名前を除去しなければならない（SHALL）。

#### Scenario: レッスンフォルダの削除

- **WHEN** レッスン「削除対象」を削除する
- **THEN** `contents/{series}/{course}/削除対象/` フォルダが削除される

### Requirement: フラット md からレッスンフォルダへの移行スクリプト

`scripts/migrate-lesson-folders.ts` を実行すると、コース直下の `{lesson}.md` を `{lesson}/contents.md` に移行しなければならない（SHALL）。移行後、元の `{lesson}.md` は存在してはならない（SHALL NOT）。

#### Scenario: フラット md をフォルダ構成に移行する

- **WHEN** `contents/シリーズ/コース/レッスン.md` が存在する状態で移行スクリプトを実行する
- **THEN** `contents/シリーズ/コース/レッスン/contents.md` が作成される
- **AND** `contents/シリーズ/コース/レッスン.md` は削除される

