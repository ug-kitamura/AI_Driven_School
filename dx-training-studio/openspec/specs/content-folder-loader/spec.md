# content-folder-loader Specification

## Purpose

`contents/` フォルダ走査による初期ロード API、表示順決定、メタデータ取得、レッスン frontmatter 解析の要件を規定する。
## Requirements
### Requirement: contents/ フォルダ走査による初期ロード

アプリ起動時に `contents/` フォルダを走査し、シリーズ・コース・レッスンの構造を `Series[]` として返す API が存在しなければならない（SHALL）。レッスンはコース直下の `{lessonName}/contents.md` から読み込まなければならない（SHALL）。フォルダが存在しない場合は空の配列を返し、エラーにしてはならない（SHALL NOT）。

#### Scenario: 正常なフォルダ構成を読み込む

- **WHEN** `contents/` 配下に有効なシリーズフォルダ・コースフォルダ・レッスンフォルダ（各 `contents.md` 含む）が存在する状態で `/api/content/load` を呼ぶ
- **THEN** `Series[]` 形式の JSON が返され、シリーズ・コース・レッスンの階層が正しく構築されている

#### Scenario: contents/ フォルダが存在しない

- **WHEN** `contents/` フォルダが存在しない状態で `/api/content/load` を呼ぶ
- **THEN** 空の配列 `[]` が返され、HTTP ステータスは 200 である

### Requirement: 数値プレフィックスによる表示順の決定
コースフォルダおよびレッスンファイルに付与された数値プレフィックス（`01_`, `02_` 等）をもとに、表示順を決定しなければならない（SHALL）。

#### Scenario: 数値プレフィックスでソートされる
- **WHEN** コースフォルダとして `02_コースB/`, `01_コースA/` が存在する
- **THEN** ロード結果のコース配列は `[コースA, コースB]` の順になる

### Requirement: _series-order.json によるシリーズ順序
`contents/_series-order.json` が存在する場合、その配列順でシリーズを並べなければならない（SHALL）。ファイルが存在しない場合はフォルダ名のアルファベット順を使用しなければならない（SHALL）。

#### Scenario: _series-order.json に従って並ぶ
- **WHEN** `_series-order.json` に `["シリーズB", "シリーズA"]` と記述されている
- **THEN** ロード結果のシリーズ配列は `[シリーズB, シリーズA]` の順になる

#### Scenario: _series-order.json が存在しない
- **WHEN** `_series-order.json` が存在しない
- **THEN** シリーズフォルダ名のアルファベット順でシリーズ配列が返される

### Requirement: _course.json によるコースメタデータの取得
各コースフォルダ内の `_course.json` が存在する場合、`target_audience`・`prerequisites`・`next_courses` を読み込まなければならない（SHALL）。存在しない場合はデフォルト値（空文字・空配列）を使用しなければならない（SHALL）。

#### Scenario: _course.json が存在する
- **WHEN** `01_コース名/_course.json` に `target_audience`, `prerequisites`, `next_courses` が記載されている
- **THEN** ロード結果のコースオブジェクトにそれらの値が反映されている

### Requirement: レッスン `.md` ファイルのフロントマター解析

レッスン `contents.md` のフロントマターを解析し、`status`・`description`・`tags`・`estimated_minutes`・`author` を取得しなければならない（SHALL）。フロントマターが壊れていてもフォルダパスから `series`・`course`・`lesson` 名を補完しなければならない（SHALL）。

#### Scenario: 有効なフロントマターを持つ contents.md

- **WHEN** フロントマターに `status: in_progress`, `tags: [git, tutorial]` が記載された `contents.md` がある
- **THEN** ロード結果のレッスンオブジェクトに `status: "in_progress"`, `tags: ["git", "tutorial"]` が設定されている

#### Scenario: フロントマターが壊れている contents.md

- **WHEN** フロントマターが存在しない `contents.md` がある
- **THEN** フォルダパスからシリーズ名・コース名・レッスン名が補完され、`status: "open"` でレッスンオブジェクトが生成される

### Requirement: contents 指紋から session.json を除外

`getContentsFingerprint` および `getContentsLatestMtime` が `contents/` ツリーを走査する際、各レッスンフォルダ内の `session.json`（`LESSON_SESSION_FILENAME`）を走査対象から除外しなければならない（SHALL）。Agent 会話の保存だけではコンテンツ hot-reload 用 fingerprint が変化してはならない（MUST NOT）。

#### Scenario: session.json 更新で fingerprint が変わらない

- **WHEN** レッスンフォルダの `session.json` のみが更新される
- **AND** `contents.md` および `.meta.json` に変更がない
- **THEN** `GET /api/content/mtime` の `fingerprint` は前回と同一である

#### Scenario: contents.md 更新で fingerprint が変わる

- **WHEN** レッスンフォルダの `contents.md` が更新される
- **THEN** `GET /api/content/mtime` の `fingerprint` は変化する

### Requirement: アンダースコア・ドット始まりのディレクトリを構造から除外する

`contents/` の走査において、名前が `_` または `.` で始まるディレクトリをシリーズ・コース・レッスンとして解釈してはならない（MUST NOT）。除外はディレクトリ名のみで判定しなければならない（SHALL）——中に何が入っているか、誰が作ったか（agent / スクリプト / 手作業）を条件にしてはならない（MUST NOT）。

中間ファイル置き場（`_work/`）はフォーカス中のフォルダ直下に作られるため、シリーズ階層および `contents/` 直下にフォーカスした状態では、除外しなければ幻のコース・幻のシリーズとして画面に現れる。

本要件はファイルには適用しない（MAY）——`.meta.json` 等の設定ファイルは従来どおり読み込む。

#### Scenario: contents/ 直下の _work は シリーズにならない
- **WHEN** `contents/_work/` が存在する状態で `/api/content/load` を呼ぶ
- **THEN** 返される `Series[]` に `_work` という名前のシリーズは含まれない

#### Scenario: シリーズ配下の _work はコースにならない
- **WHEN** `contents/シリーズA/_work/` が存在する状態で `/api/content/load` を呼ぶ
- **THEN** シリーズA の `courses` に `_work` という名前のコースは含まれない

#### Scenario: ドット始まりのディレクトリも除外される
- **WHEN** `contents/.tmp/` が存在する状態で `/api/content/load` を呼ぶ
- **THEN** 返される `Series[]` に `.tmp` という名前のシリーズは含まれない

#### Scenario: 通常のフォルダは従来どおり読み込まれる
- **WHEN** `contents/シリーズA/コースB/レッスンC/contents.md` が存在する
- **THEN** シリーズA・コースB・レッスンC が従来どおり構築される

#### Scenario: .meta.json は引き続き読み込まれる
- **WHEN** `contents/シリーズA/コースB/.meta.json` に `order` が記載されている
- **THEN** その順序がロード結果に反映される

### Requirement: レッスン frontmatter の slug・id を解析する

レッスン `contents.md` のフロントマター解析は、既存フィールド（`status`・`description`・`tags`・`estimated_minutes`・`author`）に加えて `slug` と `id` を取得しなければならない（SHALL）。`slug` / `id` が存在しない場合もエラーにせず、未設定として扱わなければならない（SHALL）。ローダーが `contents.md` へ `slug` / `id` を書き戻してはならない（SHALL NOT）——本文ファイルへの自動書込は Pane3 のオートセーブと競合するため、値の付与は生成スキルとバックフィルの責務とする。

#### Scenario: slug と id を持つ frontmatter を解析する

- **WHEN** frontmatter に `slug: what-is-version-control` と `id: lsn-version-control-a1b2c3` が記載された `contents.md` がある
- **THEN** ロード結果のレッスンオブジェクトに `slug` と `id` の値が設定されている

#### Scenario: slug と id が無い frontmatter でも従来どおり動く

- **WHEN** `slug` / `id` を持たない既存の `contents.md` をロードする
- **THEN** エラーにならず、レッスンオブジェクトの `slug` / `id` は未設定である
- **AND** `contents.md` ファイルは書き換えられていない
