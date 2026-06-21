# content-folder-loader Specification

## Purpose

`contents/` フォルダ走査による初期ロード API、表示順決定、メタデータ取得、レッスン frontmatter 解析の要件を規定する。

## Requirements

### Requirement: contents/ フォルダ走査による初期ロード
アプリ起動時に `contents/` フォルダを走査し、シリーズ・コース・レッスンの構造を `Series[]` として返す API が存在しなければならない（SHALL）。フォルダが存在しない場合は空の配列を返し、エラーにしてはならない（SHALL NOT）。

#### Scenario: 正常なフォルダ構成を読み込む
- **WHEN** `contents/` 配下に有効なシリーズフォルダ・コースフォルダ・レッスン `.md` ファイルが存在する状態で `/api/content/load` を呼ぶ
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
レッスン `.md` ファイルのフロントマターを解析し、`status`・`description`・`tags`・`estimated_minutes`・`author` を取得しなければならない（SHALL）。フロントマターが壊れていてもフォルダパスから `series`・`course`・`lesson` 名を補完しなければならない（SHALL）。

#### Scenario: 有効なフロントマターを持つ .md ファイル
- **WHEN** フロントマターに `status: in_progress`, `tags: [git, tutorial]` が記載された `.md` ファイルがある
- **THEN** ロード結果のレッスンオブジェクトに `status: "in_progress"`, `tags: ["git", "tutorial"]` が設定されている

#### Scenario: フロントマターが壊れている .md ファイル
- **WHEN** フロントマターが存在しない `.md` ファイルがある
- **THEN** ファイルパスからシリーズ名・コース名・レッスン名が補完され、`status: "open"` でレッスンオブジェクトが生成される
