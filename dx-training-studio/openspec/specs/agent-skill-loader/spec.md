# agent-skill-loader Specification

## Purpose

`.claude/skills/` 配下の Agent スキル定義を読み込み、一覧 API・Cursor 互換形式・変数注入の要件を規定する。

## Requirements

### Requirement: スキルディレクトリからの読み込み
`dx-training-studio/.claude/skills/` 配下のスキル定義（`SKILL.md`）を読み込んで一覧取得できなければならない（SHALL）。各スキルは `id`（ディレクトリ名）・`name`・`description` を返さなければならない（SHALL）。

#### Scenario: SKILL.md から id・name・description を読み込む
- **WHEN** `.claude/skills/create-draft/SKILL.md` が存在する
- **THEN** `/api/agent/skills` の応答に id `create-draft` と frontmatter の name・description が含まれる

### Requirement: スキル一覧のソート
スキル一覧 API は skill id（ディレクトリ名）のアルファベット順でスキルを返さなければならない（SHALL）。

#### Scenario: アルファベット順で返す
- **WHEN** `/api/agent/skills` を呼び出す
- **THEN** 応答の skills 配列は skill id のアルファベット順である

#### Scenario: スキル一覧を取得する
- **WHEN** `/api/agent/skills` を呼び出す
- **THEN** 登録済みスキルの id・name・description のリストが返される

#### Scenario: スキルディレクトリが空
- **WHEN** `.claude/skills/` にスキルが存在しない
- **THEN** 空の配列が返され、HTTP ステータスは 200 である

### Requirement: Cursor 互換形式
各スキルは `<skill-id>/SKILL.md` 形式で配置され、YAML frontmatter に `name` と `description` を含まなければならない（SHALL）。Cursor / Claude Code から直接参照可能でなければならない（SHALL）。

#### Scenario: SKILL.md の frontmatter を解析する
- **WHEN** `create-draft/SKILL.md` に name と description が frontmatter で定義されている
- **THEN** スキル一覧 API の応答にその name と description が含まれる

### Requirement: 変数定義
スキル frontmatter の `variables` 配列で宣言された変数を、実行時に SKILL.md 本文へ注入できなければならない（SHALL）。

#### Scenario: 変数を注入してプロンプトを構築する
- **WHEN** スキル frontmatter に `variables: [series, course, lesson]` が定義され、invoke リクエストにそれらの値が含まれる
- **THEN** SKILL.md 本文内の `{{series}}` 等のプレースホルダが置換されたプロンプトが生成される
