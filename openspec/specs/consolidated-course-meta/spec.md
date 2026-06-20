## ADDED Requirements

### Requirement: コース .meta.json に order・対象者・曼陀羅情報を統合する

コースフォルダの `.meta.json` は以下のすべてのフィールドを持たなければならない（SHALL）：

- `order`: レッスン名の配列（表示順）
- `target_audience`: 対象者の説明文字列
- `prerequisites`: 前提コース ID の配列
- `next_courses`: 次のコース ID の配列

旧来の `_lesson-order.json`・`_mandala.json`・`_meta.json`（アンダースコア版）は廃止し、これらのデータは `.meta.json` に統合する（SHALL）。

```json
{
  "order": ["バージョン管理ってなに？", "Gitの三大エリア"],
  "target_audience": "バージョン管理を全く知らない開発者",
  "prerequisites": ["course-dx-piyopiyo"],
  "next_courses": ["course-git-env"]
}
```

#### Scenario: .meta.json からレッスン順序を読み込む

- **WHEN** コース `.meta.json` の `order` が `["A", "B"]` である
- **THEN** `loadContentsFolder()` はレッスンを A → B の順に返す

#### Scenario: .meta.json から対象者情報を読み込む

- **WHEN** コース `.meta.json` の `target_audience` が `"全員"` である
- **THEN** `loadContentsFolder()` が返す `Course.target_audience` は `"全員"` である

#### Scenario: .meta.json から曼陀羅情報を読み込む

- **WHEN** コース `.meta.json` の `prerequisites` が `["course-xxx"]` である
- **THEN** `loadContentsFolder()` が返す `Course.prerequisites` は `["course-xxx"]` である

---

### Requirement: シリーズ .meta.json はコース order を持つ

シリーズフォルダの `.meta.json` は `order`（コース名の配列）フィールドを持たなければならない（SHALL）。旧来の `_course-order.json` は廃止する。

```json
{
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
