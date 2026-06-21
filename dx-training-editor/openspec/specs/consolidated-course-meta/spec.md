# consolidated-course-meta Specification

## Purpose

シリーズ・コース・レッスンの順序とコースメタデータを `.meta.json` に統合し、旧来の `_series-order.json` 等を廃止する要件を規定する。

## Requirements

### Requirement: コース .meta.json に order・対象者・曼陀羅情報を統合する

コースフォルダの `.meta.json` は以下のすべてのフィールドを持たなければならない（SHALL）：

- `id`: 安定したコース ID（`crs-{slug}-{random6}`）
- `order`: レッスン名の配列（表示順）
- `target`: 対象者の説明文字列（旧 `target_audience` は `_course.json` フォールバック時のみ互換）
- `cross_series_prev`: 別シリーズの前コース ID の配列
- `cross_series_next`: 別シリーズの次コース ID の配列

旧来の `_lesson-order.json`・`_mandala.json`・`_meta.json`（アンダースコア版）は廃止し、これらのデータは `.meta.json` に統合する（SHALL）。`prerequisites` / `next_courses` は廃止する（SHALL）。

```json
{
  "id": "crs-git-concept-a3f8c2",
  "order": ["バージョン管理ってなに？", "Gitの三大エリア"],
  "target": "バージョン管理を全く知らない開発者",
  "cross_series_prev": ["crs-dx-piyopiyo-b7d1e4"],
  "cross_series_next": ["crs-git-env-setup-x9z2k1"]
}
```

#### Scenario: .meta.json からレッスン順序を読み込む

- **WHEN** コース `.meta.json` の `order` が `["A", "B"]` である
- **THEN** `loadContentsFolder()` はレッスンを A → B の順に返す

#### Scenario: .meta.json から対象者情報を読み込む

- **WHEN** コース `.meta.json` の `target` が `"全員"` である
- **THEN** `loadContentsFolder()` が返す `Course.target` は `"全員"` である

#### Scenario: .meta.json から曼陀羅情報を読み込む

- **WHEN** コース `.meta.json` の `cross_series_prev` が `["crs-xxx-a1b2c3"]` である
- **THEN** `loadContentsFolder()` が返す `Course.cross_series_prev` は `["crs-xxx-a1b2c3"]` である

---

### Requirement: シリーズ .meta.json はコース order と id を持つ

シリーズフォルダの `.meta.json` は `id`（安定したシリーズ ID）および `order`（コース名の配列）フィールドを持たなければならない（SHALL）。旧来の `_course-order.json` は廃止する。

```json
{
  "id": "srs-git-master-a3f8c2",
  "order": ["Git概念マスターコース", "Git環境構築コース"]
}
```

#### Scenario: シリーズ .meta.json からコース順序を読み込む

- **WHEN** シリーズ `.meta.json` の `order` が `["A", "B"]` である
- **THEN** `loadContentsFolder()` はコースを A → B の順に返す

---

### Requirement: contents/.meta.json はシリーズ order を持つ

`contents/` 直下の `.meta.json` は `order`（シリーズ名の配列）フィールドを持たなければならない（SHALL）。旧来の `_series-order.json` は廃止する。

```json
{
  "order": ["はじめにシリーズ", "Git完全マスターシリーズ"]
}
```

#### Scenario: contents/.meta.json からシリーズ順序を読み込む

- **WHEN** `contents/.meta.json` の `order` が `["A", "B"]` である
- **THEN** `loadContentsFolder()` はシリーズを A → B の順に返す
