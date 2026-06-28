# agent-session-persistence Specification

## Purpose
TBD - created by archiving change lesson-folder-agent-sessions. Update Purpose after archive.
## Requirements
### Requirement: レッスン単位 session API

`GET /api/agent/session` および `PUT /api/agent/session` エンドポイントが存在し、クエリパラメータ `lessonId` でレッスンを指定しなければならない（SHALL）。ローカル dev 環境（FS 書き込み可）では、対応レッスンフォルダの `session.json` を読み書きしなければならない（SHALL）。`session.json` のスキーマは `AgentChatStorage`（`version`, `activeSessionId`, `sessions`）でなければならない（SHALL）。

#### Scenario: session.json から読み込む

- **WHEN** `GET /api/agent/session?lessonId={id}` を呼び出し、対応フォルダに `session.json` が存在する
- **THEN** HTTP 200 と `AgentChatStorage` JSON が返される

#### Scenario: session.json が存在しない

- **WHEN** `GET /api/agent/session?lessonId={id}` を呼び出し、対応フォルダに `session.json` が存在しない
- **THEN** HTTP 404 が返される

#### Scenario: session.json に保存する

- **WHEN** `PUT /api/agent/session?lessonId={id}` に有効な `AgentChatStorage` を送信する
- **THEN** 対応レッスンフォルダの `session.json` が更新される
- **AND** HTTP 200 が返される

### Requirement: FS 不可時の localStorage フォールバック

`PUT /api/agent/session` が FS 書き込み不可（501 等）で失敗した場合、クライアントは `localStorage` キー `dx-training-studio-agent-chat-v2` 内の当該 `lessonId` に `AgentChatStorage` を保存しなければならない（SHALL）。`GET` が 404 または FS 不可の場合、クライアントは同一 `localStorage` エントリから読み込まなければならない（SHALL）。

#### Scenario: API 失敗時に localStorage に保存する

- **WHEN** `PUT /api/agent/session` が 501 を返す
- **THEN** クライアントは `localStorage` に当該レッスンの `AgentChatStorage` を保存する
- **AND** UI に致命的エラーを表示しない

#### Scenario: API 404 時に localStorage から復元する

- **WHEN** `GET /api/agent/session` が 404 を返し、`localStorage` に当該 `lessonId` のデータがある
- **THEN** クライアントは `localStorage` のデータを Agent 状態として使用する

### Requirement: 旧 global localStorage キーの破棄

クライアントは旧キー `dx-training-studio-agent-chat` のデータを読み込んではならない（MUST NOT）。初回起動時に旧キーが存在しても per-lesson へマイグレーションしてはならない（MUST NOT）。

#### Scenario: 旧キーが存在しても無視する

- **WHEN** `localStorage` に `dx-training-studio-agent-chat` のみが存在する
- **AND** v2 キーに当該レッスンのデータがない
- **THEN** 空のセッション 1 件が作成される

