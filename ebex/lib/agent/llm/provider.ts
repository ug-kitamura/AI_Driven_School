import type {
  LlmMessage,
  ProviderTurnResult,
  StreamEvent,
  ToolDefinition,
} from "@/lib/agent/llm/types";

export type LlmProviderRunOptions = {
  apiKey: string;
  model: string;
  system: string;
  messages: LlmMessage[];
  tools: ToolDefinition[];
  maxTokens?: number;
  signal?: AbortSignal;
};

export interface LlmProvider {
  runTurn(options: LlmProviderRunOptions): Promise<ProviderTurnResult>;
  streamTurn(options: LlmProviderRunOptions): AsyncGenerator<StreamEvent>;
}
