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

export type LlmContentBlock =
  | LlmTextBlock
  | LlmToolUseBlock
  | LlmToolResultBlock;

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

export const MAX_AGENT_LOOP_TURNS = 24;

export const AGENT_LOOP_LIMIT_ERROR = "Agent loop limit exceeded";

/** tool_result および連続失敗時に使う（実行はしない） */
export const AGENT_BROKEN_TOOL_USE_ERROR =
  "tool_use の入力 JSON を解釈できません（出力が途中で切れた可能性があります）";

export const AGENT_MISSING_PATH_ERROR =
  "必須の path（または from/to）が欠落または空です";

export const AGENT_MISSING_SCRIPT_INPUT_ERROR =
  "必須の code（または script_path）が欠落または空です";

/** run_script / run_skill_script の入力不備時にモデルへ返す具体的な修正案内 */
export const SCRIPT_INPUT_GUIDANCE =
  'run_script の入力は {"purpose": "目的の一文", "code": "CommonJS スクリプト本文", "writes": ["書込先パス"]} です。code フィールドの JSON 文字列としてスクリプト全文を渡してください（テキスト応答やコードフェンスに書いても実行されません）。code を短く保つため、成果物の本文を文字列リテラルで埋め込まず、ディスク上のファイル（md ドラフト・テンプレート等）を fs.readFileSync で読んで組み立ててください。run_skill_script はスキルに scripts/ が同梱されている場合のみ使えます。';

/** 応答が max_tokens で途中終了した場合に付す注記 */
export const MAX_TOKENS_TRUNCATION_NOTE =
  "直前の応答は出力トークン上限で途中終了しました。コードを短くする（本文の埋め込みをやめてディスクから読む・処理を分割する）ことで 1 回の応答に収めてください。";

/** 巨大 write 失敗時にモデルへ返す汎用案内（スキル固有ロジックではない） */
export const LARGE_FILE_WRITE_GUIDANCE =
  "大きな成果物は write_file 一発で書かず、run_script を最優先で使ってください: 本文を tool 引数に載せず、ディスク上のデータ（md ドラフト・テンプレート等）を読んで変換・書込する短い Node.js コードを実行します。補助として copy_file でテンプレートをコピーし、replace_in_file / replace_between（大きな本文は from_path）で差し込み、必要なら append_file で partial を積む方法も使えます。";

export const AGENT_REPEATED_TOOL_ERROR =
  "同一のツールエラーが連続したためエージェントを停止しました";

/** 同一エラー連続の許容回数（この回数まではモデルへ返し、+1 で停止） */
export const MAX_CONSECUTIVE_IDENTICAL_TOOL_ERRORS = 2;
