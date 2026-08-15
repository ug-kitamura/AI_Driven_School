# stable-entity-ids Specification

## Purpose

シリーズ・コースに安定した英数字 ID を付与し、フォルダ名変更後も曼陀羅リンクが解決できるようにする。

## Requirements

### Requirement: シリーズ ID は `.meta.json` に保存した安定した英数字 ID である

各シリーズは `srs-{slug}-{random6}` 形式の一意な ID を持たなければならない（SHALL）。この ID は `contents/<series>/.meta.json` の `id` フィールドに保存しなければならない（SHALL）。ローダーは `.meta.json` に `id` が存在する場合はそれを使用し、存在しない場合は新たに生成して即座に書き込まなければならない（SHALL）。ID はアルファベット小文字・数字・ハイフンのみで構成されなければならない（SHALL）。

#### Scenario: 既存 `.meta.json` に id がある場合はそれを使用する

- **WHEN** `series/.meta.json` に `"id": "srs-git-master-a3f8c2"` が記述されている
- **THEN** ローダーはそのシリーズの ID を `srs-git-master-a3f8c2` として使用する

#### Scenario: `.meta.json` に id がない場合は生成して書き込む

- **WHEN** `series/.meta.json` に `id` フィールドが存在しない
- **THEN** ローダーは `srs-{slug}-{random6}` 形式の ID を生成する
- **AND** 生成した ID を `.meta.json` に書き込む
- **AND** そのセッション内で同シリーズには常に同じ ID を使用する

#### Scenario: ID にはフォルダ名に含まれる日本語が入らない

- **WHEN** シリーズフォルダ名が `Git完全マスターシリーズ` である
- **THEN** シリーズ ID は `srs-git-master-a3f8c2` のように ASCII 文字のみで構成される
- **AND** ID に日本語文字が含まれない

### Requirement: コース ID は `.meta.json` に保存した安定した英数字 ID である

各コースは `crs-{slug}-{random6}` 形式の一意な ID を持たなければならない（SHALL）。この ID は `contents/<series>/<course>/.meta.json` の `id` フィールドに保存しなければならない（SHALL）。ローダーは `.meta.json` に `id` が存在する場合はそれを使用し、存在しない場合は新たに生成して即座に書き込まなければならない（SHALL）。ID はアルファベット小文字・数字・ハイフンのみで構成されなければならない（SHALL）。

#### Scenario: 既存 `.meta.json` に id がある場合はそれを使用する

- **WHEN** `course/.meta.json` に `"id": "crs-git-env-setup-b7d1e4"` が記述されている
- **THEN** ローダーはそのコースの ID を `crs-git-env-setup-b7d1e4` として使用する

#### Scenario: `.meta.json` に id がない場合は生成して書き込む

- **WHEN** `course/.meta.json` に `id` フィールドが存在しない
- **THEN** ローダーは `crs-{slug}-{random6}` 形式の ID を生成する
- **AND** 生成した ID を `.meta.json` に書き込む

#### Scenario: フォルダのリネーム後も ID が変わらない

- **WHEN** コースフォルダを `Git環境構築コース` から `Git環境セットアップ` にリネームする
- **AND** `.meta.json` に既存の `id` が保存されている
- **THEN** ローダーはリネーム後も同じ `id` を使用する

#### Scenario: cross_series_prev / cross_series_next に記録された ID が一致する

- **WHEN** コース A の `cross_series_next` に `"crs-python-intro-x9z2k1"` が記録されている
- **AND** コース B の `.meta.json` の `id` が `"crs-python-intro-x9z2k1"` である
- **THEN** ローダーはコース A の cross_series_next がコース B を参照していると解決できる

### Requirement: レッスン ID は frontmatter に保存した安定した英数字 ID である

各レッスンは `lsn-{slug}-{random6}` 形式の一意な ID を持たなければならない（SHALL）。この ID は `contents.md` のフロントマターの `id` フィールドに保存しなければならない（SHALL）。ID はアルファベット小文字・数字・ハイフンのみで構成されなければならない（SHALL）。

シリーズ・コースと異なり、ローダーは ID が存在しない場合に**生成して書き戻してはならない**（SHALL NOT）——`contents.md` は原稿本文と同居しており、ロード時の自動書込は編集中のオートセーブと競合する。ID の付与は `dx-training-create` の生成時書込と既存分のバックフィルで行う。フォルダ名をリネームしても、frontmatter に保存された ID は変わってはならない（SHALL NOT）。

#### Scenario: 既存 frontmatter に id がある場合はそれを使用する

- **WHEN** レッスンの frontmatter に `id: lsn-version-control-a1b2c3` が記述されている
- **THEN** ローダーはそのレッスンの ID を `lsn-version-control-a1b2c3` として使用する

#### Scenario: レッスンフォルダのリネーム後も ID が変わらない

- **WHEN** レッスンフォルダを `バージョン管理ってなに？` から `バージョン管理とは` にリネームする
- **AND** frontmatter に既存の `id` が保存されている
- **THEN** リネーム後も同じ `id` が使用される

#### Scenario: id が無いレッスンを書き換えない

- **WHEN** frontmatter に `id` が無いレッスンをロードする
- **THEN** ローダーは `contents.md` に `id` を書き込まない
