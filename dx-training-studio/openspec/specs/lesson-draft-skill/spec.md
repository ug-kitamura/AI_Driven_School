# lesson-draft-skill Specification

## Purpose

選択中レッスンから markdown 草稿を生成する `create-draft` Agent スキルの存在・入出力・Phase 1 制約を規定する。
## Requirements
### Requirement: レッスン草稿作成スキルの存在

`create-draft` スキルが `dx-training-studio/.claude/skills/create-draft/SKILL.md` に存在しなければならない（SHALL）。選択中レッスンのメタ情報と本文を入力として受け取り、markdown 形式の草稿を生成しなければならない（SHALL）。frontmatter `variables` には `series`, `course`, `lesson`, `lessonBody`, `courseMeta`, `lessonMeta`, `availableTags` を含めなければならない（SHALL）。frontmatter `tools` には `search_company_context` と `select_company_context` を含めなければならない（SHALL）。`lessonMeta` は JSON 文字列（現在レッスンの `status`, `tags`, `description`, `estimated_minutes`, `author`）でなければならない（SHALL）。`availableTags` は JSON 文字列（ワークスペース内既存レッスン tags のユニーク配列）でなければならない（SHALL）。

#### Scenario: スキル一覧に表示される

- **WHEN** `/api/agent/skills` を呼び出す

- **THEN** `create-draft` スキルが一覧に含まれる

#### Scenario: レッスン草稿を生成する

- **WHEN** ユーザーが create-draft スキルを呼び出し、variables に `series`, `course`, `lesson`, `lessonBody`, `courseMeta`, `lessonMeta`, `availableTags` が渡される

- **THEN** AI がフロントマター付き markdown 形式のレッスン草稿を返す

### Requirement: 草稿の markdown 形式

生成される草稿は YAML frontmatter（`series`, `course`, `lesson`, `status`, `description`, `tags`, `estimated_minutes`, `author`）と markdown 本文を含まなければならない（SHALL）。`status` は `lessonMeta` の値（`open` | `in_progress` | `done` のいずれか）をそのまま用いなければならない（SHALL）。`tags` は `lessonMeta.tags` をそのまま用い、`draft` や日本語等 `[a-z0-9-]+` 外の tag を invent してはならない（MUST NOT）。`description` のみ草稿内容に合わせて更新してよい（MAY）。

#### Scenario: フロントマター付き草稿が返される

- **WHEN** create-draft スキルが草稿を生成する

- **THEN** 応答に `---` で囲まれた YAML frontmatter と markdown 本文が含まれる

#### Scenario: lessonMeta の status を維持する

- **WHEN** `lessonMeta` に `"status": "open"` が含まれる

- **AND** create-draft が草稿を生成する

- **THEN** 草稿 frontmatter の status は `open` である

### Requirement: create-draft Phase 2 対話フロー

`create-draft` スキル本文は、Pane 3 Agent ビューのチャット対話で次のフェーズを実行する手順を記述しなければならない（SHALL）: (1) レッスン・コース情報から検索キーワードを自然文で提案し、ユーザーの承認後 `search_company_context` tool で検索する、(2) tool result の検索結果を markdown 表で提示し、ユーザーの自然言語選択意図を理解したうえで `select_company_context` tool を呼び出す、(3) **`body` が空でない item のみ**（`select_company_context` の tool result）を草稿に織り込む。0 件ヒット時は社内コンテキストダイアログからの登録を促さなければならない（SHALL）。**タグ候補の `[tag1, tag2]` 形式による検索フェーズは用いてはならない**（MUST NOT）。機械可読プロトコル行（`検索キーワード:` / `選択確定:` / `検索結果承認`）を出力してはならない（MUST NOT）。

#### Scenario: 検索結果を表で提示する

- **WHEN** `search_company_context` tool が 3 件を返す

- **THEN** AI は 3 件分の markdown 表と選択の指示をチャットで提示する

#### Scenario: ユーザーが番号で選択する

- **WHEN** AI が 3 件の表を提示した

- **AND** ユーザーが「1 と 3 で」と自然文で返信する

- **THEN** AI は `select_company_context` を `{ selection: [1, 3] }` で呼び出す

#### Scenario: 再検索は tool 経由

- **WHEN** ユーザーが自然言語で再検索を依頼する

- **AND** AI が新キーワードを確認する

- **THEN** AI は `search_company_context` を新 query で呼び出す

#### Scenario: 0 件選択

- **WHEN** ユーザーが社内コンテキストを使わない旨を伝える

- **THEN** AI は `select_company_context` を `{ selection: "none" }` で呼び出す

- **AND** 社内コンテキストなしでの生成確認を求める

#### Scenario: 0 件ヒット

- **WHEN** `search_company_context` が空配列を返す

- **THEN** AI は社内コンテキストの登録を促すメッセージを返す

- **AND** レッスン情報のみの草稿生成はユーザーの明示的承認後に行ってよい

### Requirement: 社内コンテキストの草稿への織り込み

`select_company_context` tool result に含まれる item（`body` 付き）のみを草稿に使わなければならない（SHALL）。各 item の `body` をレッスン内の適切な箇所に配置しなければならない（SHALL）。検索 summary（`body` 空）の item の `source_url` を草稿に引用してはならない（MUST NOT）。プロジェクト固有タグ（例: `xyz`）の内容は `> **xyz ワンポイント**` 形式の blockquote 等で区別してよい（MAY）。

#### Scenario: 社内コンテキストを blockquote で反映

- **WHEN** `select_company_context` の tool result に `body` 付きの `xyz` タグアイテムが含まれる

- **AND** ユーザーが草稿生成を承認する

- **THEN** 応答 markdown に xyz 向けのワンポイント blockquote が含まれる

#### Scenario: 未選択 item を織り込まない

- **WHEN** 検索結果に item 1 と item 2 がある

- **AND** `select_company_context` が `{ selection: [2] }` で実行された

- **THEN** 草稿に item 1 の `source_url` や本文が含まれない

