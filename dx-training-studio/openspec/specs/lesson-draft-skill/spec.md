# lesson-draft-skill Specification

## Purpose

選択中レッスンから markdown 草稿を生成する `create-draft` Agent スキルの存在・入出力・Phase 1 制約を規定する。
## Requirements
### Requirement: レッスン草稿作成スキルの存在

`create-draft` スキルが `dx-training-studio/.claude/skills/create-draft/SKILL.md` に存在しなければならない（SHALL）。選択中レッスンのメタ情報と本文を入力として受け取り、markdown 形式の草稿を生成しなければならない（SHALL）。frontmatter `variables` には `series`, `course`, `lesson`, `lessonBody`, `courseMeta`, `contextItems`, `lessonMeta`, `availableTags` を含めなければならない（SHALL）。`contextItems` は JSON 文字列（検索済み社内コンテキスト配列。未検索時は `"[]"`）でなければならない（SHALL）。`lessonMeta` は JSON 文字列（現在レッスンの `status`, `tags`, `description`, `estimated_minutes`, `author`）でなければならない（SHALL）。`availableTags` は JSON 文字列（ワークスペース内既存レッスン tags のユニーク配列）でなければならない（SHALL）。

#### Scenario: スキル一覧に表示される

- **WHEN** `/api/agent/skills` を呼び出す

- **THEN** `create-draft` スキルが一覧に含まれる

#### Scenario: レッスン草稿を生成する

- **WHEN** ユーザーが create-draft スキルを呼び出し、variables に `series`, `course`, `lesson`, `lessonBody`, `courseMeta`, `contextItems`, `lessonMeta`, `availableTags` が渡される

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

`create-draft` スキル本文は、Pane 3 Agent ビューのチャット対話で次のフェーズを実行する手順を記述しなければならない（SHALL）: (1) レッスン・コース情報から社内コンテキスト検索キーワードを **`検索キーワード: xxx`** 形式で提案し、クライアントが `GET /api/context/items/search?q=...` を実行する、(2) 検索結果を markdown 表で提示し、ユーザーの自然言語選択意図を **`選択確定: 1,3` / `all` / `none`** 行に変換する、(3) **`body` が空でない item のみ** を草稿に織り込む（選択確定前の `contextItems` は `body` 空の一覧）。0 件ヒット時は社内コンテキストダイアログからの登録を促さなければならない（SHALL）。**タグ候補の `[tag1, tag2]` 形式による検索フェーズは用いてはならない**（MUST NOT）。検索キーワード `xxx` に **`「」` 等の引用符を含めてはならない**（MUST NOT）。`選択確定:` 行のみ返すターンでは草稿 markdown を生成せず、クライアントの自動続行後に Phase 3 へ進む（SHALL）。

#### Scenario: 検索結果を表で提示する

- **WHEN** クライアントが検索 API から 3 件を取得する

- **AND** 次の invoke が実行される

- **THEN** AI は 3 件分の markdown 表と選択の指示をチャットで提示する

- **AND** `variables.contextItems` の各 item の `body` は空である

#### Scenario: ユーザーが番号で選択する

- **WHEN** AI が 3 件の表を提示した

- **AND** ユーザーが `1,3` と返信する

- **THEN** AI は `選択確定: 1,3` 行を返す

- **AND** 次 invoke 以降 `variables.contextItems` には 1 番と 3 番のみ（`body` 付き）が含まれる

#### Scenario: 再検索はプロトコル経由

- **WHEN** ユーザーが自然言語で再検索を依頼する

- **AND** AI が `検索キーワード: 新キーワード` を提示する

- **AND** ユーザーが `ok` と返信する

- **THEN** クライアントは `新キーワード` で検索 API を再実行する

#### Scenario: 0 件選択

- **WHEN** ユーザーが社内コンテキストを使わない旨を伝える

- **THEN** AI は `選択確定: none` を返す

- **AND** 社内コンテキストなしでの生成確認を求める

#### Scenario: 0 件ヒット

- **WHEN** 検索 API が空配列を返す

- **THEN** AI は社内コンテキストの登録を促すメッセージを返す

- **AND** レッスン情報のみの草稿生成はユーザーの明示的承認後に行ってよい

#### Scenario: 括弧なしキーワード提案

- **WHEN** AI が検索キーワードを提案する

- **THEN** 提案行は `検索キーワード: ブランチ` のように引用符なしのキーワードを含む

### Requirement: 社内コンテキストの草稿への織り込み

`contextItems` のうち **`body` が空でない item のみ** を草稿に使わなければならない（SHALL）。各 item の `body` をレッスン内の適切な箇所に配置しなければならない（SHALL）。`body` が空の item の `source_url` を草稿に引用してはならない（MUST NOT）。プロジェクト固有タグ（例: `xyz`）の内容は `> **xyz ワンポイント**` 形式の blockquote 等で区別してよい（MAY）。

#### Scenario: 社内コンテキストを blockquote で反映

- **WHEN** `contextItems` に `body` 付きの `xyz` タグアイテムが含まれる

- **AND** ユーザーが草稿生成を承認する

- **THEN** 応答 markdown に xyz 向けのワンポイント blockquote が含まれる

#### Scenario: 未選択 item を織り込まない

- **WHEN** 検索結果に item 1 と item 2 がある

- **AND** `選択確定: 2` が適用されている

- **THEN** 草稿に item 1 の `source_url` や本文が含まれない

