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
  /** パース失敗時も残す不完全 JSON（path 抽出用） */
  partialJson?: string;
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

/** 1 回の LLM turn（text および／または tool_use + tool_result） */
export type AgentLogicalTurn = {
  text?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    result: string;
  }>;
};

export const MAX_AGENT_LOOP_TURNS = 10;

export const AGENT_LOOP_LIMIT_ERROR = "Agent loop limit exceeded";

/** tool_result および連続失敗時に使う（実行はしない） */
export const AGENT_BROKEN_TOOL_USE_ERROR =
  "tool_use の入力 JSON を解釈できません（出力が途中で切れた可能性があります）";

export const AGENT_MISSING_PATH_ERROR =
  "必須の path（または from/to）が欠落または空です";

/** 巨大 write 失敗時にモデルへ返す汎用案内（スキル固有ロジックではない） */
export const LARGE_FILE_WRITE_GUIDANCE =
  "大きな HTML やテンプレート成果物は write_file 一発で書かず、copy_file で references/base.html 等のテンプレートを output へコピーし、replace_in_file で {{PLACEHOLDER}} を置換してください。CSS が必要なら style.css を読み、<style> へのインライン化は置換で行ってください。";

export const AGENT_REPEATED_TOOL_ERROR =
  "同一のツールエラーが連続したためエージェントを停止しました";

/** 同一エラー連続の許容回数（この回数まではモデルへ返し、+1 で停止） */
export const MAX_CONSECUTIVE_IDENTICAL_TOOL_ERRORS = 2;
