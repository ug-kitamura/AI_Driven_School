## ADDED Requirements

### Requirement: フォルダ名・ファイル名はスラッグ固定とする
`contents/` 以下のシリーズフォルダ・コースフォルダ・レッスン `.md` ファイルの名前は `[a-z0-9-]+` 形式の ASCII kebab-case スラッグとする。数値プレフィックスは使用しない。

#### Scenario: スラッグ形式のフォルダが正しく読み込まれる
- **WHEN** `contents/git-mastery/git-concepts/version-control.md` が存在する
- **THEN** アプリはシリーズ名 `git-mastery`、コース名 `git-concepts`、レッスン名 `version-control` として認識する

#### Scenario: 数値プレフィックス付きフォルダは認識対象外
- **WHEN** `contents/01_Git完全マスター/` というフォルダが存在する
- **THEN** アプリはこのフォルダをスラッグ形式ではないとして扱わない（マイグレーション後は存在しない前提）

### Requirement: 順序は JSON ファイルで管理する
各ディレクトリレベルの表示順序は以下の JSON ファイルで定義する。
- `contents/_series-order.json`: シリーズのスラッグ配列
- `contents/<series>/_course-order.json`: コースのスラッグ配列
- `contents/<series>/<course>/_lesson-order.json`: レッスンのスラッグ配列（拡張子なし）

#### Scenario: 順序 JSON に従ってシリーズが並ぶ
- **WHEN** `_series-order.json` が `["intro", "git-mastery", "python-basics"]` の場合
- **THEN** Pane 1 はこの順序でシリーズを表示する

#### Scenario: 順序 JSON に含まれないアイテムは末尾に追加される
- **WHEN** `_course-order.json` に載っていないコースフォルダが存在する
- **THEN** そのコースは既存の順序の末尾に追加されて表示される

### Requirement: normalizeContentsFolder はリネームしない
`normalizeContentsFolder()` は欠けている JSON ファイルの生成のみを行い、フォルダ名・ファイル名のリネームは一切行わない。

#### Scenario: 欠けている順序 JSON が自動生成される
- **WHEN** `_lesson-order.json` が存在しないコースフォルダに `.md` ファイルがある
- **THEN** `normalizeContentsFolder()` 実行後に `_lesson-order.json` が生成され、既存レッスンが alphabetical 順で列挙される

#### Scenario: 欠けている _meta.json が自動生成される
- **WHEN** `_meta.json` が存在しないシリーズフォルダがある
- **THEN** `normalizeContentsFolder()` 実行後に `_meta.json` が生成され、`title.ja` にフォルダ名（スラッグ）がプレースホルダーとして設定される

### Requirement: スラッグは作成後ロックされる
スラッグは通常の編集操作では変更できない。変更するには専用の「スラッグを変更...」操作が必要で、警告ダイアログを経由する。

#### Scenario: 通常のリネーム操作ではスラッグが変わらない
- **WHEN** ユーザーがシリーズ名（`_meta.json` の `title.ja`）を変更する
- **THEN** フォルダ名（スラッグ）は変わらず、`_meta.json` の `title.ja` のみ更新される

#### Scenario: スラッグ変更操作は警告を表示する
- **WHEN** ユーザーが「スラッグを変更...」を操作してスラッグを変更する
- **THEN** 「外部リンクや参照が壊れる可能性があります」という警告ダイアログが表示される
