## ADDED Requirements

### Requirement: マイグレーションスクリプトが既存 contents/ を新フォーマットに変換する

`scripts/migrate-content.ts` を実行すると、既存の `contents/` ツリーをプレフィックスなし構成に一括変換しなければならない（SHALL）。

変換内容：
1. すべてのシリーズフォルダ・コースフォルダ・レッスン `.md` ファイルから `NN_` プレフィックスをリネームで除去する
2. `contents/.meta.json` を `{ "order": [...シリーズ名] }` として生成する
3. 各シリーズの `.meta.json` を `{ "order": [...コース名] }` として生成する
4. 各コースの `.meta.json` を `{ "id": "...", "order": [...レッスン名], "target": "...", "cross_series_prev": [...], "cross_series_next": [...] }` として生成する（既存の `.meta.json` から `target`/`cross_series_prev`/`cross_series_next` を引き継ぎ、`_mandala.json` の値とマージする）
5. 旧ファイル（`_series-order.json`、`_course-order.json`、`_lesson-order.json`、`_mandala.json`、`_meta.json`（アンダースコア版））を削除する

#### Scenario: シリーズフォルダのプレフィックスが除去される

- **WHEN** マイグレーションスクリプトを実行する
- **THEN** `contents/01_はじめにシリーズ/` が `contents/はじめにシリーズ/` にリネームされる

#### Scenario: contents/.meta.json が生成される

- **WHEN** マイグレーションスクリプトを実行する
- **THEN** `contents/.meta.json` が `{ "order": ["はじめにシリーズ", "Git完全マスターシリーズ", ...] }` として生成される

#### Scenario: コース .meta.json に order が追加される

- **WHEN** マイグレーションスクリプトを実行する
- **THEN** 各コース `.meta.json` に `order` フィールドが追加され、レッスン名一覧が格納される

#### Scenario: 旧メタファイルが削除される

- **WHEN** マイグレーションスクリプトを実行する
- **THEN** `_series-order.json`、`_course-order.json`、`_lesson-order.json`、`_mandala.json`、`_meta.json` が削除される

---

### Requirement: マイグレーション前に確認プロンプトを表示する

スクリプト実行時、上書き前にユーザーへの確認プロンプトを表示しなければならない（SHALL）。`N` または Enter を入力した場合はキャンセルし、`y` を入力した場合のみ変換を実行する。

#### Scenario: キャンセルした場合は変換しない

- **WHEN** マイグレーションスクリプトを実行し、確認プロンプトで `N` を入力する
- **THEN** `contents/` は変更されない
