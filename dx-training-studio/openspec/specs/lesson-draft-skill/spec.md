# lesson-draft-skill Specification

## Purpose

選択中レッスンから markdown 草稿を生成する `create-draft` Agent スキルの存在・入出力・Phase 1 制約を規定する。
## Requirements
### Requirement: レッスン草稿作成スキルの存在

`create-draft` スキルが `dx-training-studio/.claude/skills/create-draft/SKILL.md` に存在しなければならない（SHALL）。選択中レッスンのメタ情報と本文を入力として受け取り、markdown 形式の草稿を生成しなければならない（SHALL）。frontmatter `variables` には `series`, `course`, `lesson`, `lessonBody`, `courseMeta`, `contextItems` を含めなければならない（SHALL）。`contextItems` は JSON 文字列（検索済み社内コンテキスト配列。未検索時は `"[]"`）でなければならない（SHALL）。

#### Scenario: スキル一覧に表示される

- **WHEN** `/api/agent/skills` を呼び出す
- **THEN** `create-draft` スキルが一覧に含まれる

#### Scenario: レッスン草稿を生成する

- **WHEN** ユーザーが create-draft スキルを呼び出し、variables に `series`, `course`, `lesson`, `lessonBody`, `courseMeta`, `contextItems` が渡される
- **THEN** AI がフロントマター付き markdown 形式のレッスン草稿を返す

### Requirement: 草稿の markdown 形式
生成される草稿は YAML frontmatter（`series`, `course`, `lesson`, `status`, `description`, `tags`, `estimated_minutes`）と markdown 本文を含まなければならない（SHALL）。

#### Scenario: フロントマター付き草稿が返される
- **WHEN** create-draft スキルが草稿を生成する
- **THEN** 応答に `---` で囲まれた YAML frontmatter と markdown 本文が含まれる

### Requirement: create-draft Phase 2 対話フロー

`create-draft` スキル本文は、Pane 3 Agent ビューのチャット対話で次のフェーズを実行する手順を記述しなければならない（SHALL）: (1) レッスン・コース情報からタグ候補を `[tag1, tag2]` 形式で提示しユーザー確認を待つ、(2) `contextItems` が空でないときヒット件数とタイトル一覧を提示し盛り込み確認を待つ、(3) 承認後に社内コンテキストを織り込んだ草稿を生成する。0 件ヒット時は社内コンテキストダイアログからの登録を促さなければならない（SHALL）。

#### Scenario: タグ確認後に検索結果を提示する

- **WHEN** ユーザーがタグ候補を承認する
- **AND** `contextItems` に 2 件以上のアイテムが含まれる
- **THEN** AI はヒット件数とタイトル一覧をチャットで提示する
- **AND** 盛り込み確認を求める

#### Scenario: 0 件ヒット

- **WHEN** `contextItems` が空配列である
- **THEN** AI は社内コンテキストの登録を促すメッセージを返す
- **AND** レッスン情報のみの草稿生成はユーザーの明示的承認後に行ってよい

### Requirement: 社内コンテキストの草稿への織り込み

`contextItems` が渡されたとき、生成草稿は各アイテムの内容をレッスン内の適切な箇所に配置しなければならない（SHALL）。プロジェクト固有タグ（例: `xyz`）の内容は `> **xyz ワンポイント**` 形式の blockquote 等で区別してよい（MAY）。事前に人間が挿入位置を指定する必要はない（MUST NOT）。

#### Scenario: 社内コンテキストを blockquote で反映

- **WHEN** `contextItems` に `xyz` タグのアイテムが含まれる
- **AND** ユーザーが草稿生成を承認する
- **THEN** 応答 markdown に xyz 向けのワンポイント blockquote が含まれる

