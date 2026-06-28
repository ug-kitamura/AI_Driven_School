import { resolveAiApiKey } from "@/lib/api-keys";
import { AI_KEY_ERROR } from "@/lib/agent/anthropic-stream";
import {
  buildAssistantToolUseMessage,
  buildToolResultMessages,
} from "@/lib/agent/llm/anthropic";
import type { LlmMessage, AgentToolEvent } from "@/lib/agent/llm/types";
import {
  AGENT_LOOP_LIMIT_ERROR,
  MAX_AGENT_LOOP_TURNS,
} from "@/lib/agent/llm/types";
import { resolveLlmProvider } from "@/lib/agent/llm/resolve-provider";
import { createCreateDraftToolSession } from "@/lib/agent/tools/create-draft-session";
import { executeRegisteredTool, resolveToolDefinitions } from "@/lib/agent/tools/registry";
import { parseContextMode } from "@/lib/context-resolve";
import type { ToolDefinition } from "@/lib/agent/llm/types";

export type AgentLoopEmit = (event: string, data: unknown) => void;

export type RunAgentLoopOptions = {
  req: Request;
  system: string;
  messages: LlmMessage[];
  toolNames: string[];
  emit: AgentLoopEmit;
  signal?: AbortSignal;
};

export type RunAgentLoopResult =
  | { ok: true; toolEvents: AgentToolEvent[] }
  | { ok: false; error: string; status: number };

function parseContextModeFromRequest(req: Request): "local" | "database" {
  return parseContextMode(req.headers.get("x-context-mode"));
}

export async function runAgentLoop(
  options: RunAgentLoopOptions,
): Promise<RunAgentLoopResult> {
  const apiKey = resolveAiApiKey(options.req);
  if (!apiKey) {
    return { ok: false, error: AI_KEY_ERROR, status: 401 };
  }

  const providerResult = resolveLlmProvider(options.req);
  if (!providerResult.ok) {
    return { ok: false, error: providerResult.error, status: providerResult.status };
  }

  const tools: ToolDefinition[] = resolveToolDefinitions(options.toolNames);
  const session = createCreateDraftToolSession();
  const contextMode = parseContextModeFromRequest(options.req);
  const llmMessages = [...options.messages];
  const toolEvents: AgentToolEvent[] = [];

  for (let turn = 0; turn < MAX_AGENT_LOOP_TURNS; turn += 1) {
    let turnResult = null;
    for await (const event of providerResult.provider.streamTurn({
      apiKey,
      model: providerResult.model,
      system: options.system,
      messages: llmMessages,
      tools,
      signal: options.signal,
    })) {
      if (event.type === "text_delta") {
        options.emit("text_delta", { text: event.text });
      } else if (event.type === "turn_complete") {
        turnResult = event.result;
      }
    }

    if (!turnResult) {
      return { ok: false, error: "Empty model response", status: 502 };
    }

    if (turnResult.toolCalls.length === 0) {
      options.emit("done", {});
      return { ok: true, toolEvents };
    }

    const assistantMessage = buildAssistantToolUseMessage(turnResult);
    if (assistantMessage) {
      llmMessages.push(assistantMessage);
    }

    const toolResults: string[] = [];
    for (const call of turnResult.toolCalls) {
      options.emit("tool_start", { name: call.name, input: call.input, toolUseId: call.id });
      toolEvents.push({
        phase: "start",
        name: call.name,
        input: call.input,
        toolUseId: call.id,
        display: call.name,
      });

      const outcome = await executeRegisteredTool(
        call.name,
        call.input,
        session,
        contextMode,
      );
      const resultJson = JSON.stringify(outcome.result);
      toolResults.push(resultJson);

      options.emit("tool_end", {
        name: call.name,
        toolUseId: call.id,
        summary: outcome.display.summary,
        display: outcome.display.display,
        result: resultJson,
        tags: outcome.display.tags,
      });
      toolEvents.push({
        phase: "end",
        name: call.name,
        toolUseId: call.id,
        summary: outcome.display.summary,
        display: outcome.display.display,
        result: resultJson,
        tags: outcome.display.tags,
      });
    }

    llmMessages.push(...buildToolResultMessages(turnResult.toolCalls, toolResults));
  }

  return { ok: false, error: AGENT_LOOP_LIMIT_ERROR, status: 422 };
}

export function createAgentLoopSseStream(
  run: (emit: AgentLoopEmit) => Promise<RunAgentLoopResult>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const emit: AgentLoopEmit = (event, data) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const result = await run(emit);
        if (!result.ok) {
          emit("error", { message: result.error });
          controller.close();
          return;
        }
        if (result.ok) {
          controller.close();
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "スキル実行に失敗しました";
        emit("error", { message });
        controller.close();
      }
    },
  });
}
