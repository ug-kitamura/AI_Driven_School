export type LlmRole = "user" | "assistant";

export type LlmTextBlock = {
  type: "text";
  text: string;
};

export type LlmToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type LlmToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

export type LlmContentBlock = LlmTextBlock | LlmToolUseBlock | LlmToolResultBlock;

export type LlmMessage = {
  role: LlmRole;
  content: string | LlmContentBlock[];
};

export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** tool_use の input JSON パースに失敗したとき true */
  inputParseError?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ProviderTurnResult = {
  text: string;
  toolCalls: ToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "unknown";
};

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "turn_complete"; result: ProviderTurnResult };

export type AgentToolEvent = {
  name: string;
  phase: "start" | "end";
  toolUseId?: string;
  input?: Record<string, unknown>;
  summary?: string;
  display: string;
  result?: string;
  tags?: string[];
};

export const MAX_AGENT_LOOP_TURNS = 10;

export const AGENT_LOOP_LIMIT_ERROR = "Agent loop limit exceeded";

export const AGENT_BROKEN_TOOL_USE_ERROR =
  "壊れた tool_use のためエージェントを停止しました（入力 JSON を解釈できません）";

export const AGENT_MISSING_PATH_ERROR =
  "壊れた tool_use のためエージェントを停止しました（必須の path が欠落または空です）";

export const AGENT_REPEATED_TOOL_ERROR =
  "同一のツールエラーが連続したためエージェントを停止しました";

/** 同一エラー連続の許容回数（この回数まではモデルへ返し、+1 で停止） */
export const MAX_CONSECUTIVE_IDENTICAL_TOOL_ERRORS = 2;
