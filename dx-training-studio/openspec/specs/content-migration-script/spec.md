# content-migration-script Specification

## Purpose

`data/content.json` から `contents/` フォルダ構成への初回移行スクリプトの要件を規定する。
## Requirements
### Requirement: content.json から contents/ フォルダへの変換
`scripts/migrate-content.ts` を `npx ts-node scripts/migrate-content.ts` で実行すると、`data/content.json` の内容を `contents/` フォルダ構成に変換しなければならない（SHALL）。

#### Scenario: 正常に移行が完了する
- **WHEN** `data/content.json` が存在する状態でスクリプトを実行する
- **THEN** `contents/` フォルダが生成され、シリーズ・コース・レッスンの階層がフォルダ/ファイルとして書き出される

#### Scenario: contents/ が既に存在する場合
- **WHEN** `contents/` フォルダがすでに存在する状態でスクリプトを実行する
- **THEN** 上書き確認プロンプトが表示され、`y` を入力した場合のみ上書きされる

### Requirement: 移行後に content.json を削除しない
移行スクリプトは `data/content.json` を削除してはならない（SHALL NOT）。バックアップとして保持する。

#### Scenario: 移行後の content.json 確認
- **WHEN** 移行スクリプトが正常に完了する
- **THEN** `data/content.json` はそのまま残存している

### Requirement: 数値プレフィックスの自動付与
移行スクリプトは `content.json` 内のコース・レッスンの配列順序をもとに数値プレフィックス（`01_`, `02_`, ...）を付与しなければならない（SHALL）。

#### Scenario: コースに番号が振られる
- **WHEN** `content.json` のシリーズ内に `[コースA, コースB, コースC]` の順でコースが並んでいる
- **THEN** 生成されるフォルダが `01_コースA/`, `02_コースB/`, `03_コースC/` となる

### Requirement: フラット md からレッスンフォルダへの移行

`scripts/migrate-lesson-folders.ts` を `npx ts-node scripts/migrate-lesson-folders.ts` で実行すると、コース直下の `{lesson}.md` を `{lesson}/contents.md` に移行しなければならない（SHALL）。コース `.meta.json` の `order` はレッスン名のまま維持されなければならない（SHALL）。

#### Scenario: フラット md を移行する

- **WHEN** `contents/シリーズ/コース/レッスン.md` が存在する状態でスクリプトを実行する
- **THEN** `contents/シリーズ/コース/レッスン/contents.md` が作成される
- **AND** 元の `レッスン.md` は削除される

#### Scenario: 既にレッスンフォルダ構成の場合

- **WHEN** 当該レッスンがすでに `{lesson}/contents.md` 形式である
- **THEN** スクリプトは当該エントリをスキップする

