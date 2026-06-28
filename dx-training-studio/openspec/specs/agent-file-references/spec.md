# agent-file-references Specification

## Purpose

Agent invoke 時に参照可能な `contents/` 配下 markdown ファイルの一覧 API と、許可パスの制限を規定する。
## Requirements
### Requirement: contents ファイル一覧 API

`GET /api/agent/files` エンドポイントが存在し、`contents/**/contents.md` の全ファイルを返さなければならない（SHALL）。`current` クエリパラメータで選択中レッスンの path が渡された場合、そのファイルを先頭に、残りを path のアルファベット順で返さなければならない（SHALL）。

#### Scenario: 全ファイルを返す

- **WHEN** `/api/agent/files` を呼び出す
- **THEN** `contents/**/contents.md` の path と name のリストが返される

#### Scenario: 選択中レッスンを先頭にする

- **WHEN** `/api/agent/files?current=contents/foo/bar/lesson/contents.md` を呼び出す
- **THEN** 応答の先頭が `contents/foo/bar/lesson/contents.md` で、残りは path のアルファベット順である

### Requirement: 許可パスの制限

参照可能ファイルは `contents/` 配下の `contents.md` に限定されなければならない（SHALL）。それ以外のパスは一覧にも invoke 添付にも含めてはならない（SHALL NOT）。

#### Scenario: 許可外パスを一覧に含めない

- **WHEN** プロジェクト内に `images/foo.png` または `.claude/skills/create-draft/SKILL.md` が存在する
- **THEN** `/api/agent/files` の応答にそれらは含まれない

