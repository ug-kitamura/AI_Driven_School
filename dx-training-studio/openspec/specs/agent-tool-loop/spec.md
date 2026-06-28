# agent-tool-loop Specification

## Purpose
TBD - created by archiving change refactor-create-draft-tool-loop. Update Purpose after archive.
## Requirements
### Requirement: 副作用は tool 経由のみ

Agent スキル実行において、DB 検索・ファイル書き込み等の副作用は LLM tool use 経由でのみ実行されなければならない（SHALL）。クライアントまたは invoke 前処理が assistant / user メッセージを regex で解析し副作用を起こしてはならない（MUST NOT）。チャット本文に `検索キーワード:` / `選択確定:` 等の機械可読プロトコル行を要求してはならない（MUST NOT）。

#### Scenario: テキストプロトコル行に依存しない

- **WHEN** `create-draft` スキルが実行される

- **THEN** 社内コンテキスト検索は `search_company_context` tool の呼び出しによってのみ実行される

- **AND** クライアントはメッセージ本文から検索クエリを regex 抽出しない

#### Scenario: 自然言語のみでユーザーが承認する

- **WHEN** ユーザーが「いいです」「お願いします」等の自然文で承認する

- **THEN** AI が意図を解釈し、必要な tool を呼び出す

- **AND** クライアントは短い承認トークンを regex マッチしない

### Requirement: tool 定義の配置

各 tool の schema と executor は `lib/agent/tools/` 配下に配置されなければならない（SHALL）。invoke route と将来の adapter（MCP 等）は同一 executor を呼び出さなければならない（SHALL）。

#### Scenario: 共有 executor を invoke から呼ぶ

- **WHEN** invoke route が `search_company_context` tool を実行する

- **THEN** `lib/agent/tools/` 内の executor が `GET /api/context/items/search` と同等の検索ロジックを用いる

### Requirement: スキル frontmatter の tools 宣言

スキル frontmatter は `tools:` 配列で当該スキルが使用可能な tool 名を宣言できなければならない（SHALL）。invoke route は宣言された tool のみを Anthropic API に渡さなければならない（SHALL）。`tools` 未宣言のスキルは tool なしで実行されなければならない（SHALL）。

#### Scenario: create-draft が tool subset を宣言する

- **WHEN** `create-draft/SKILL.md` の frontmatter に `tools: [search_company_context, select_company_context]` が定義されている

- **AND** create-draft で invoke が実行される

- **THEN** Anthropic API 呼び出しには当該 2 tool のみが含まれる

### Requirement: server-side agent loop

`POST /api/agent/invoke` は 1 回の HTTP リクエスト内で agent loop を実行しなければならない（SHALL）。model が tool_use を返した場合、サーバーは tool を実行し tool_result を messages に追加してから model を再呼び出ししなければならない（SHALL）。最終 assistant テキストまたはエラーで loop を終了しなければならない（SHALL）。loop 上限（例: 10 ターン）は設定可能でなければならない（SHALL）。

#### Scenario: 検索 tool 実行後に会話が継続する

- **WHEN** model が `search_company_context` の tool_use を返す

- **THEN** サーバーが tool を実行し tool_result を messages に追加する

- **AND** 同一 HTTP リクエスト内で model が再呼び出される

- **AND** 最終応答がクライアントにストリームされる

#### Scenario: loop 上限超過

- **WHEN** tool 実行が loop 上限を超える

- **THEN** HTTP 500 または 422 とエラーメッセージが返される

### Requirement: tool result の最小化

tool result は token 節約のため必要最小限のフィールドのみ含めなければならない（SHALL）。`search_company_context` の result では各 item の `body` は空文字でなければならない（SHALL）。`select_company_context` の result のみ選択 item の `body` を含めてよい（MAY）。

#### Scenario: 検索 result は summary のみ

- **WHEN** `search_company_context` が 3 件を返す

- **THEN** tool_result 内の各 item に `title`, `source_url`, `tags`, `source_last_updated_at` 等のメタが含まれる

- **AND** 各 item の `body` は空文字である

#### Scenario: 選択 result は body 付き

- **WHEN** `select_company_context` が indices `[2]` で実行される

- **THEN** tool_result には 2 番 item のみが含まれる

- **AND** 当該 item の `body` が空でない

### Requirement: create-draft 専用 tools

`create-draft` スキルは少なくとも次の tool を使用しなければならない（SHALL）:

- `search_company_context({ query: string })` — 社内コンテキストを検索し summary 一覧を返す
- `select_company_context({ selection: number[] | "all" | "none" })` — 直前の検索結果から参照 item を確定し body 付き subset を返す

#### Scenario: 再検索

- **WHEN** ユーザーが自然言語で別キーワードでの再検索を依頼する

- **AND** AI が `search_company_context` を新 query で呼び出す

- **THEN** 新しい検索結果が tool_result として messages に追加される

#### Scenario: DB 未接続

- **WHEN** `search_company_context` 実行時に DB が未接続である

- **THEN** tool_result にエラー情報が含まれる

- **AND** AI はユーザーに接続エラーを伝えられる

### Requirement: メッセージ履歴における tool 記録

Agent 会話の永続化において、tool_use と tool_result は messages 履歴の一部として保存されなければならない（SHALL）。別途スキル専用の並行状態（例: `createDraftContext`）を保持してはならない（MUST NOT）。

#### Scenario: セッション復元後に検索結果が復元される

- **WHEN** create-draft 対話中に `search_company_context` が実行された

- **AND** ユーザーがページをリロードする

- **THEN** 保存済み messages から検索結果 tool_result が復元表示される

### Requirement: LLM provider adapter 層

agent loop は LLM プロバイダ固有 API を直接呼び出してはならない（MUST NOT）。`lib/agent/llm/` に共通型（`LlmMessage`, `ToolCall`, `ToolResult` 等）と provider adapter interface を定義し、tool loop は adapter 経由でのみ LLM と通信しなければならない（SHALL）。tool executor（`lib/agent/tools/`）は adapter と独立し、プロバイダ非依存でなければならない（SHALL）。

#### Scenario: 初回実装は Anthropic adapter のみ

- **WHEN** `x-ai-model: claude-sonnet-4-6` で invoke が実行される

- **THEN** Anthropic adapter が tool use 付き stream を実行する

#### Scenario: 未実装 provider は adapter 層で拒否

- **WHEN** `x-ai-model: gpt-5-nano` 等、adapter 未実装の slug で invoke が実行される

- **THEN** HTTP 400 と「このモデルは未対応です」が返される

- **AND** invoke route が OpenAI / Gemini API を直接呼び出すことはない

#### Scenario: 将来 adapter 追加時に tool loop を変更しない

- **WHEN** 将来 OpenAI または Gemini adapter が追加される

- **THEN** `lib/agent/tools/` の executor と agent loop ロジックは変更なしで再利用できる

