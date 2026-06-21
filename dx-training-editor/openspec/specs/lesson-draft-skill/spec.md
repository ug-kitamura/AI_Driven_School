# lesson-draft-skill Specification

## Purpose

選択中レッスンから markdown 草稿を生成する `create-draft` Agent スキルの存在・入出力・Phase 1 制約を規定する。

## Requirements

### Requirement: レッスン草稿作成スキルの存在
`create-draft` スキルが `dx-training-editor/.claude/skills/create-draft/SKILL.md` に存在しなければならない（SHALL）。選択中レッスンのメタ情報と本文を入力として受け取り、markdown 形式の草稿を生成しなければならない（SHALL）。

#### Scenario: スキル一覧に表示される
- **WHEN** `/api/agent/skills` を呼び出す
- **THEN** `create-draft` スキルが一覧に含まれる

#### Scenario: レッスン草稿を生成する
- **WHEN** ユーザーが create-draft スキルを呼び出し、variables に `series`, `course`, `lesson`, `lessonBody`, `courseMeta` が渡される
- **THEN** AI がフロントマター付き markdown 形式のレッスン草稿を返す

### Requirement: Phase 1 は社内コンテキスト DB 非連携
create-draft スキルは Phase 1 では社内コンテキスト DB を参照してはならない（SHALL NOT）。将来の DB 連携に備え、スキル本文に拡張可能な構造（タグ検索ステップのプレースホルダ等）を含めてもよい（MAY）。

#### Scenario: DB なしで草稿を生成する
- **WHEN** 社内コンテキスト DB が未構築の状態で create-draft を実行する
- **THEN** レッスン情報のみをもとに草稿が正常に生成される

### Requirement: 草稿の markdown 形式
生成される草稿は YAML frontmatter（`series`, `course`, `lesson`, `status`, `description`, `tags`, `estimated_minutes`）と markdown 本文を含まなければならない（SHALL）。

#### Scenario: フロントマター付き草稿が返される
- **WHEN** create-draft スキルが草稿を生成する
- **THEN** 応答に `---` で囲まれた YAML frontmatter と markdown 本文が含まれる
