# agent-invoke-api Specification

## Purpose

DX Training Editor の Agent ビュー向け API を定義する。`POST /api/agent/invoke` によるスキル実行・ストリーミング応答、`GET /api/agent/config` によるモデル表示名の取得、会話履歴と `@` 参照ファイルの Anthropic API への受け渡しを規定する。
## Requirements
### Requirement: スキル実行 API
`POST /api/agent/invoke` エンドポイントが存在し、指定されたスキルを Anthropic API で実行しなければならない（SHALL）。

#### Scenario: スキルを実行してストリーミング応答を返す
- **WHEN** `{ skillId: "create-draft", variables: { ... }, messages: [...] }` で invoke を呼ぶ
- **THEN** Anthropic API が呼び出され、`text/event-stream` 形式で応答が返される

#### Scenario: 存在しないスキル ID
- **WHEN** 存在しない skillId で invoke を呼ぶ
- **THEN** HTTP 404 とエラーメッセージが返される

#### Scenario: API キー未設定
- **WHEN** AI API キーが未設定の状態で invoke を呼ぶ
- **THEN** HTTP 401 と設定を促すエラーメッセージが返される

### Requirement: 既存 API キー解決の流用
スキル実行 API は既存の `resolveAiApiKey()` を使用して API キーを解決しなければならない（SHALL）。モデルは **`x-ai-model` リクエストヘッダーを優先**し、ヘッダーが無いとき **`process.env.AI_MODEL`**、それも無いとき **`claude-sonnet-4-6`** を用いなければならない（SHALL）。`gpt-5-nano` 等の未対応 slug がサーバーに到達した場合、HTTP 400 と「このモデルは未対応です」を返さなければならない（SHALL）。

#### Scenario: WorkspaceSettings の API キーを使用する
- **WHEN** WorkspaceSettings に AI API キーが設定されている
- **THEN** そのキーで Anthropic API が呼び出される

#### Scenario: x-ai-model ヘッダーを優先する
- **WHEN** クライアントが `x-ai-model: claude-sonnet-4-6` を送信する
- **AND** 環境変数 `AI_MODEL` が別の値に設定されている
- **THEN** Anthropic API 呼び出しは `claude-sonnet-4-6` を用いる

#### Scenario: 未対応モデルを拒否する
- **WHEN** クライアントが `x-ai-model: gpt-5-nano` を送信する
- **THEN** HTTP 400 と「このモデルは未対応です」が返される

### Requirement: チャット履歴の受け渡し
invoke リクエストは `messages` 配列（role + content）を受け取り、Anthropic API の messages パラメータに渡さなければならない（SHALL）。

#### Scenario: 会話履歴を含めて実行する
- **WHEN** messages に過去 2 ターン分の user/assistant メッセージが含まれる
- **THEN** Anthropic API 呼び出しにその履歴が含まれる

### Requirement: @ 参照ファイルの添付解決
invoke リクエストの user メッセージに含まれる `@path` トークンをサーバー側で解析し、許可されたパスのファイル内容を読み込んで Anthropic messages に添付しなければならない（SHALL）。

#### Scenario: 有効な @ 参照を添付する
- **WHEN** user メッセージに `@contents/series/course/lesson.md` が含まれ、ファイルが存在する
- **THEN** ファイル内容が user メッセージのコンテキストとして Anthropic API に渡される

#### Scenario: 存在しない @ 参照
- **WHEN** user メッセージに存在しない `@path` が含まれる
- **THEN** HTTP 400 とエラーメッセージが返される

#### Scenario: 許可外パスを拒否する
- **WHEN** user メッセージに `contents/` 以外の `@path`、または `../` を含むパスが含まれる
- **THEN** HTTP 400 とエラーメッセージが返される

### Requirement: Agent 設定 API
`GET /api/agent/config` エンドポイントが存在し、Agent ビュー表示用の設定情報を JSON で返してよい（MAY）。**モデル表示名の SSoT はクライアント側のワークスペース設定** とし、フッター表示に本 API の `modelLabel` を必須としない（MUST NOT）。本 API は後方互換のため存続してよい（MAY）。

#### Scenario: モデル情報を取得する
- **WHEN** クライアントが `GET /api/agent/config` を呼ぶ
- **THEN** `{ model, modelLabel }` 形式の JSON が返される

#### Scenario: カスタム AI_MODEL を反映する
- **WHEN** 環境変数 `AI_MODEL` が `claude-opus-4-6` に設定されている
- **THEN** レスポンスの `model` は `claude-opus-4-6` である

#### Scenario: 未登録モデルの表示名
- **WHEN** `model` に表示名マップ未登録の slug が設定されている
- **THEN** `modelLabel` は `model` と同じ slug 文字列が返される

