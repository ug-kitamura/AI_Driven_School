## ADDED Requirements

### Requirement: マイグレーションスクリプトで一括変換できる
`scripts/migrate-content.ts` を実行することで、既存の `contents/` フォルダを新フォーマット（スラッグ + 順序 JSON + メタデータ分離）に一括変換できる。

#### Scenario: 数値プレフィックスが除去されてスラッグ化される
- **WHEN** `migrate-content.ts` を実行する
- **THEN** `contents/01_Git完全マスターシリーズ/02_Git概念マスターコース/01_バージョン管理ってなに？.md` が `contents/git-kanzen-master-series/git-gainen-master-course/version-control.md` のようなスラッグ形式に変換される（スラッグは既存表示名を sanitize して生成）

#### Scenario: 順序 JSON が生成される
- **WHEN** `migrate-content.ts` を実行する
- **THEN** `_series-order.json`、各シリーズの `_course-order.json`、各コースの `_lesson-order.json` が既存の数値順序に基づいて生成される

#### Scenario: _meta.json が生成される
- **WHEN** `migrate-content.ts` を実行する
- **THEN** 各シリーズ・コースフォルダに `_meta.json` が生成され、`title.ja` に旧フォルダ名（プレフィックス除去済みの表示名）が設定される

#### Scenario: .meta.json が _mandala.json に変換される
- **WHEN** `migrate-content.ts` を実行する
- **THEN** 既存の `.meta.json`（`target_audience`, `prerequisites`, `next_courses` を含む）が `_mandala.json` に rename され、`target_audience` は `_meta.json` の `target_audience.ja` に移動する。`prerequisites` / `next_courses` はスラッグ参照に変換される

### Requirement: マイグレーションスクリプトは冪等である
`migrate-content.ts` を複数回実行しても、2 回目以降は変更が発生しない（すでに変換済みの場合はスキップする）。

#### Scenario: 変換済みフォルダに対して再実行しても変化しない
- **WHEN** マイグレーション済みの `contents/` フォルダに対して再度 `migrate-content.ts` を実行する
- **THEN** ファイルシステムに変更が発生しない
