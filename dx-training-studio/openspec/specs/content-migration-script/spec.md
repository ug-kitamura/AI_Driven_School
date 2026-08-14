# content-migration-script Specification

## Purpose

`contents/` の構造を移行するスクリプトの要件を規定する。
## Requirements
### Requirement: フラット md からレッスンフォルダへの移行

`scripts/migrate-lesson-folders.ts` を `npx ts-node scripts/migrate-lesson-folders.ts` で実行すると、コース直下の `{lesson}.md` を `{lesson}/contents.md` に移行しなければならない（SHALL）。コース `.meta.json` の `order` はレッスン名のまま維持されなければならない（SHALL）。

#### Scenario: フラット md を移行する

- **WHEN** `contents/シリーズ/コース/レッスン.md` が存在する状態でスクリプトを実行する
- **THEN** `contents/シリーズ/コース/レッスン/contents.md` が作成される
- **AND** 元の `レッスン.md` は削除される

#### Scenario: 既にレッスンフォルダ構成の場合

- **WHEN** 当該レッスンがすでに `{lesson}/contents.md` 形式である
- **THEN** スクリプトは当該エントリをスキップする

