import type {
  LlmContentBlock,
  LlmMessage,
  ProviderTurnResult,
  StreamEvent,
  ToolCall,
} from "@/lib/agent/llm/types";
import type { LlmProvider, LlmProviderRunOptions } from "@/lib/agent/llm/provider";
import { DEFAULT_AI_MODEL } from "@/lib/ai-models";
import { resolveAiModel } from "@/lib/resolve-ai-model";

export const DEFAULT_MODEL = DEFAULT_AI_MODEL;
export const AI_KEY_ERROR =
  "AI API キーを設定（歯車）するか、サーバーに AI_API_KEY を設定してください";

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

export function resolveAnthropicModel(req?: Request): string {
  if (req) {
    const result = resolveAiModel(req);
    if (result.ok) return result.model;
  }
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicApiMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

function toAnthropicMessages(messages: LlmMessage[]): AnthropicApiMessage[] {
  return messages.map((message) => {
    if (typeof message.content === "string") {
      return { role: message.role, content: message.content };
    }
    return {
      role: message.role,
      content: message.content.map((block) => {
        switch (block.type) {
          case "text":
            return { type: "text" as const, text: block.text };
          case "tool_use":
            return {
              type: "tool_use" as const,
              id: block.id,
              name: block.name,
              input: block.input,
            };
          case "tool_result":
            return {
              type: "tool_result" as const,
              tool_use_id: block.tool_use_id,
              content: block.content,
            };
        }
      }),
    };
  });
}

function buildAssistantContent(result: ProviderTurnResult): LlmContentBlock[] {
  const blocks: LlmContentBlock[] = [];
  if (result.text) {
    blocks.push({ type: "text", text: result.text });
  }
  for (const call of result.toolCalls) {
    blocks.push({
      type: "tool_use",
      id: call.id,
      name: call.name,
      input: call.input,
    });
  }
  return blocks;
}

export function buildToolResultMessages(
  toolCalls: ToolCall[],
  results: string[],
): LlmMessage[] {
  if (toolCalls.length === 0) return [];
  return [
    {
      role: "user",
      content: toolCalls.map((call, index) => ({
        type: "tool_result" as const,
        tool_use_id: call.id,
        content: results[index] ?? "{}",
      })),
    },
  ];
}

export function buildAssistantToolUseMessage(result: ProviderTurnResult): LlmMessage | null {
  const content = buildAssistantContent(result);
  if (content.length === 0) return null;
  return { role: "assistant", content };
}

async function* parseAnthropicStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  const toolBlocks: Array<{
    id: string;
    name: string;
    inputJson: string;
    input?: Record<string, unknown>;
  }> = [];
  let stopReason: ProviderTurnResult["stopReason"] = "unknown";

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const lines = chunk.split("\n");
        const dataLine = lines.find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        const payload = dataLine.slice("data: ".length).trim();
        if (!payload || payload === "[DONE]") continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          continue;
        }

        switch (event.type) {
          case "content_block_start": {
            const index = event.index as number | undefined;
            const contentBlock = event.content_block as
              | { type?: string; id?: string; name?: string }
              | undefined;
            if (
              contentBlock?.type === "tool_use" &&
              contentBlock.id &&
              contentBlock.name &&
              typeof index === "number"
            ) {
              toolBlocks[index] = {
                id: contentBlock.id,
                name: contentBlock.name,
                inputJson: "",
              };
            }
            break;
          }
          case "content_block_delta": {
            const delta = event.delta as
              | { type?: string; text?: string; partial_json?: string }
              | undefined;
            if (delta?.type === "text_delta" && delta.text) {
              text += delta.text;
              yield { type: "text_delta", text: delta.text };
            }
            if (delta?.type === "input_json_delta" && delta.partial_json) {
              const index = event.index as number | undefined;
              const block = typeof index === "number" ? toolBlocks[index] : undefined;
              if (block) block.inputJson += delta.partial_json;
            }
            break;
          }
          case "content_block_stop": {
            const index = event.index as number | undefined;
            const block = typeof index === "number" ? toolBlocks[index] : undefined;
            if (block?.inputJson) {
              try {
                block.input = JSON.parse(block.inputJson) as Record<string, unknown>;
              } catch {
                block.input = {};
              }
            }
            break;
          }
          case "message_delta": {
            const delta = event.delta as { stop_reason?: string } | undefined;
            if (delta?.stop_reason === "tool_use") stopReason = "tool_use";
            if (delta?.stop_reason === "end_turn") stopReason = "end_turn";
            if (delta?.stop_reason === "max_tokens") stopReason = "max_tokens";
            break;
          }
          default:
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const calls: ToolCall[] = toolBlocks
    .filter((block): block is NonNullable<typeof block> => block !== undefined)
    .map((block) => ({
      id: block.id,
      name: block.name,
      input: block.input ?? {},
    }));

  if (calls.length > 0 && stopReason === "unknown") {
    stopReason = "tool_use";
  }
  if (calls.length === 0 && stopReason === "unknown") {
    stopReason = "end_turn";
  }

  yield {
    type: "turn_complete",
    result: { text, toolCalls: calls, stopReason },
  };
}

async function runAnthropicTurn(options: LlmProviderRunOptions): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens ?? 8192,
      stream: true,
      system: options.system,
      messages: toAnthropicMessages(options.messages),
      tools: options.tools.length > 0 ? options.tools : undefined,
    }),
    signal: options.signal,
  });
}

export const anthropicProvider: LlmProvider = {
  async runTurn(options) {
    for await (const event of this.streamTurn(options)) {
      if (event.type === "turn_complete") return event.result;
    }
    return { text: "", toolCalls: [], stopReason: "unknown" };
  },

  async *streamTurn(options) {
    const upstream = await runAnthropicTurn(options);
    if (!upstream.ok) {
      let message = "Anthropic API error";
      try {
        const data = (await upstream.json()) as {
          error?: { type?: string; message?: string };
        };
        const apiMessage = data.error?.message?.trim();
        const apiType = data.error?.type?.trim();
        message =
          apiMessage && apiType && !apiMessage.includes(apiType)
            ? `${apiType}: ${apiMessage}`
            : apiMessage || apiType || message;
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }
    if (!upstream.body) {
      throw new Error("empty Anthropic response");
    }
    yield* parseAnthropicStream(upstream.body, options.signal);
  },
};

export async function streamAnthropicMessages(options: {
  req: Request;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}): Promise<Response> {
  const { resolveAiApiKey } = await import("@/lib/api-keys");
  const apiKey = resolveAiApiKey(options.req);
  if (!apiKey) {
    return Response.json({ error: AI_KEY_ERROR }, { status: 401 });
  }

  const modelResult = resolveAiModel(options.req);
  if (!modelResult.ok) {
    return Response.json({ error: modelResult.error }, { status: 400 });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelResult.model,
      max_tokens: options.maxTokens ?? 8192,
      stream: true,
      system: options.system,
      messages: options.messages,
    }),
  });

  if (!upstream.ok) {
    let message = "Anthropic API error";
    try {
      const data = (await upstream.json()) as {
        error?: { type?: string; message?: string };
      };
      const apiMessage = data.error?.message?.trim();
      const apiType = data.error?.type?.trim();
      message =
        apiMessage && apiType && !apiMessage.includes(apiType)
          ? `${apiType}: ${apiMessage}`
          : apiMessage || apiType || message;
    } catch {
      // ignore parse errors
    }
    return Response.json({ error: message }, { status: upstream.status });
  }

  if (!upstream.body) {
    return Response.json({ error: "empty Anthropic response" }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export { toAnthropicMessages, buildAssistantContent };
