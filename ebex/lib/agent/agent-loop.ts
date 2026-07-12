import { resolveAiApiKey } from "@/lib/api-keys";
import { AI_KEY_ERROR } from "@/lib/agent/anthropic-stream";
import {
  buildAssistantToolUseMessage,
  buildToolResultMessages,
} from "@/lib/agent/llm/anthropic";
import type { LlmMessage, AgentToolEvent, ToolCall } from "@/lib/agent/llm/types";
import {
  AGENT_BROKEN_TOOL_USE_ERROR,
  AGENT_LOOP_LIMIT_ERROR,
  AGENT_MISSING_PATH_ERROR,
  AGENT_REPEATED_TOOL_ERROR,
  MAX_AGENT_LOOP_TURNS,
  MAX_CONSECUTIVE_IDENTICAL_TOOL_ERRORS,
} from "@/lib/agent/llm/types";
import { resolveLlmProvider } from "@/lib/agent/llm/resolve-provider";
import { resolveMaxOutputTokens } from "@/lib/resolve-max-output-tokens";
import {
  executeRegisteredTool,
  resolveToolDefinitions,
  type ToolExecutionContext,
} from "@/lib/agent/tools/registry";
import { resolveConfirmRequirement } from "@/lib/agent/tools/confirm-gate";
import { awaitToolConfirmDecision } from "@/lib/agent/tools/tool-confirm-registry";
import type { ToolDefinition } from "@/lib/agent/llm/types";

export type AgentLoopEmit = (event: string, data: unknown) => void;

export type RunAgentLoopOptions = {
  req: Request;
  system: string;
  messages: LlmMessage[];
  toolNames: string[];
  emit: AgentLoopEmit;
  signal?: AbortSignal;
  projectFolderId?: string;
  skillId?: string;
  skillDirAbsolute?: string;
};

export type RunAgentLoopResult =
  | { ok: true; toolEvents: AgentToolEvent[] }
  | { ok: false; error: string; status: number };

const PATH_REQUIRED_TOOLS = new Set(["read_file", "write_file", "mkdir"]);

export function isBrokenToolUse(call: ToolCall): string | null {
  if (call.inputParseError) {
    return AGENT_BROKEN_TOOL_USE_ERROR;
  }
  if (PATH_REQUIRED_TOOLS.has(call.name)) {
    const pathValue = call.input?.path;
    if (typeof pathValue !== "string" || !pathValue.trim()) {
      return AGENT_MISSING_PATH_ERROR;
    }
  }
  return null;
}

export function extractToolErrorMessage(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const error = (result as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error : null;
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
  const maxTokens = resolveMaxOutputTokens(options.req, providerResult.model);
  const llmMessages = [...options.messages];
  const toolEvents: AgentToolEvent[] = [];
  const projectFolderId = options.projectFolderId;
  const skillOptions = {
    skillId: options.skillId,
    skillDirAbsolute: options.skillDirAbsolute,
  };
  const toolContext: ToolExecutionContext | undefined = projectFolderId
    ? {
        projectRoot: process.cwd(),
        projectFolderId,
        ...skillOptions,
      }
    : undefined;

  let consecutiveError: string | null = null;
  let consecutiveErrorCount = 0;

  for (let turn = 0; turn < MAX_AGENT_LOOP_TURNS; turn += 1) {
    let turnResult = null;
    for await (const event of providerResult.provider.streamTurn({
      apiKey,
      model: providerResult.model,
      system: options.system,
      messages: llmMessages,
      tools,
      maxTokens,
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

    for (const call of turnResult.toolCalls) {
      const broken = isBrokenToolUse(call);
      if (broken) {
        options.emit("tool_start", {
          name: call.name,
          input: call.input,
          toolUseId: call.id,
        });
        options.emit("tool_end", {
          name: call.name,
          toolUseId: call.id,
          summary: "error",
          display: `✗ ${broken}`,
          result: JSON.stringify({ error: broken }),
        });
        return { ok: false, error: broken, status: 422 };
      }
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

      const requirement = toolContext
        ? resolveConfirmRequirement(
            toolContext.projectRoot,
            toolContext.projectFolderId,
            call,
            skillOptions,
          )
        : null;

      let outcome;
      if (requirement) {
        options.emit("confirm_required", {
          toolUseId: call.id,
          kind: requirement.kind,
          path: requirement.path,
          isNew: requirement.isNew,
        });
        const decision = await awaitToolConfirmDecision(call.id);
        if (decision === "reject") {
          outcome = {
            result: {
              rejected: true,
              path: requirement.path,
              reason: "ユーザーが確認ダイアログで拒否しました",
            },
            display: {
              summary: "拒否",
              display: `✗ ユーザーが拒否: ${requirement.path}`,
            },
          };
        } else {
          outcome = await executeRegisteredTool(call.name, call.input, toolContext);
        }
      } else {
        outcome = await executeRegisteredTool(call.name, call.input, toolContext);
      }

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

      const errorMessage = extractToolErrorMessage(outcome.result);
      if (errorMessage) {
        if (errorMessage === consecutiveError) {
          consecutiveErrorCount += 1;
        } else {
          consecutiveError = errorMessage;
          consecutiveErrorCount = 1;
        }
        if (consecutiveErrorCount > MAX_CONSECUTIVE_IDENTICAL_TOOL_ERRORS) {
          const message = `${AGENT_REPEATED_TOOL_ERROR}: ${errorMessage}`;
          return { ok: false, error: message, status: 422 };
        }
      } else {
        consecutiveError = null;
        consecutiveErrorCount = 0;
      }
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
