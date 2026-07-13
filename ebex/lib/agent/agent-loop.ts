import { resolveAiApiKey } from "@/lib/api-keys";
import { AI_KEY_ERROR } from "@/lib/agent/anthropic-stream";
import {
  buildAssistantToolUseMessage,
  buildToolResultMessages,
} from "@/lib/agent/llm/anthropic";
import type {
  LlmMessage,
  AgentToolEvent,
  AgentLogicalTurn,
  ToolCall,
} from "@/lib/agent/llm/types";
import {
  AGENT_BROKEN_TOOL_USE_ERROR,
  AGENT_LOOP_LIMIT_ERROR,
  AGENT_MISSING_PATH_ERROR,
  AGENT_MISSING_SCRIPT_INPUT_ERROR,
  AGENT_REPEATED_TOOL_ERROR,
  LARGE_FILE_WRITE_GUIDANCE,
  MAX_AGENT_LOOP_TURNS,
  MAX_CONSECUTIVE_IDENTICAL_TOOL_ERRORS,
  MAX_TOKENS_TRUNCATION_NOTE,
  SCRIPT_INPUT_GUIDANCE,
} from "@/lib/agent/llm/types";
import { resolveLlmProvider } from "@/lib/agent/llm/resolve-provider";
import { resolveMaxOutputTokens } from "@/lib/resolve-max-output-tokens";
import {
  executeRegisteredTool,
  isScriptToolName,
  normalizeScriptToolCall,
  preflightScriptToolCall,
  resolveToolDefinitions,
  type ToolExecutionContext,
  type ToolExecutionOutcome,
} from "@/lib/agent/tools/registry";
import {
  resolveConfirmRequirement,
  seedSkipOverwritePathsFromHistory,
  collectWrittenPathsFromToolResult,
  normalizeConfirmPath,
} from "@/lib/agent/tools/confirm-gate";
import { awaitToolConfirmDecision } from "@/lib/agent/tools/tool-confirm-registry";
import {
  resolveSearchProvider,
  SEARCH_REJECTED_GUIDANCE,
  type SearchSessionState,
} from "@/lib/agent/tools/search-provider";
import { checkProjectFolderExists } from "@/lib/agent/project-folder-guard";
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
  | { ok: true; toolEvents: AgentToolEvent[]; toolTurns: AgentLogicalTurn[] }
  | { ok: false; error: string; status: number };

const PATH_REQUIRED_TOOLS = new Set([
  "read_file",
  "write_file",
  "mkdir",
  "replace_in_file",
  "replace_between",
  "append_file",
]);

export function isBrokenToolUse(call: ToolCall): string | null {
  if (call.inputParseError) {
    return AGENT_BROKEN_TOOL_USE_ERROR;
  }
  if (call.name === "copy_file") {
    const from = call.input?.from;
    const to = call.input?.to;
    if (
      typeof from !== "string" ||
      !from.trim() ||
      typeof to !== "string" ||
      !to.trim()
    ) {
      return AGENT_MISSING_PATH_ERROR;
    }
    return null;
  }
  if (call.name === "run_script") {
    const code = call.input?.code;
    if (typeof code !== "string" || !code.trim()) {
      return AGENT_MISSING_SCRIPT_INPUT_ERROR;
    }
    return null;
  }
  if (call.name === "run_skill_script") {
    const scriptPath = call.input?.script_path;
    if (typeof scriptPath !== "string" || !scriptPath.trim()) {
      return AGENT_MISSING_SCRIPT_INPUT_ERROR;
    }
    return null;
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

function brokenToolOutcome(
  message: string,
  options?: { truncatedByMaxTokens?: boolean },
): ToolExecutionOutcome {
  // script 系の入力不備には schema を再提示する（LARGE_FILE_WRITE_GUIDANCE は
  // 「run_script を使え」という案内のため、run_script 自体の失敗には循環して役立たない）
  const baseGuidance =
    message === AGENT_MISSING_SCRIPT_INPUT_ERROR
      ? SCRIPT_INPUT_GUIDANCE
      : LARGE_FILE_WRITE_GUIDANCE;
  const guidance = options?.truncatedByMaxTokens
    ? `${MAX_TOKENS_TRUNCATION_NOTE} ${baseGuidance}`
    : baseGuidance;
  return {
    result: {
      error: message,
      recoverable: true,
      guidance,
    },
    display: {
      summary: "error",
      display: `✗ ${message}`,
    },
  };
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
    return {
      ok: false,
      error: providerResult.error,
      status: providerResult.status,
    };
  }

  const tools: ToolDefinition[] = resolveToolDefinitions(options.toolNames);
  const maxTokens = resolveMaxOutputTokens(options.req, providerResult.model);
  const llmMessages = [...options.messages];
  const toolEvents: AgentToolEvent[] = [];
  const toolTurns: AgentLogicalTurn[] = [];
  const projectFolderId = options.projectFolderId;
  const skillOptions = {
    skillId: options.skillId,
    skillDirAbsolute: options.skillDirAbsolute,
  };
  const searchProvider = resolveSearchProvider(options.req);
  const searchSession: SearchSessionState = { unavailable: false };
  const toolContext: ToolExecutionContext | undefined = projectFolderId
    ? {
        projectRoot: process.cwd(),
        projectFolderId,
        ...skillOptions,
        search: { provider: searchProvider, session: searchSession },
      }
    : undefined;

  const projectRoot = process.cwd();

  let consecutiveError: string | null = null;
  let consecutiveErrorCount = 0;
  let turnText = "";
  /** AI 作成済み／上書き許可済み → 以降の overwrite 確認をスキップ */
  const skipOverwritePaths = seedSkipOverwritePathsFromHistory(llmMessages);

  const emitLogicalTurn = (turn: AgentLogicalTurn) => {
    if (!turn.text?.trim() && !(turn.toolCalls && turn.toolCalls.length > 0)) {
      return;
    }
    toolTurns.push(turn);
    options.emit("logical_turn", turn);
  };

  for (let turn = 0; turn < MAX_AGENT_LOOP_TURNS; turn += 1) {
    if (projectFolderId) {
      const missing = checkProjectFolderExists(projectRoot, projectFolderId);
      if (missing) {
        return { ok: false, error: missing, status: 409 };
      }
    }

    turnText = "";
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
        turnText += event.text;
        options.emit("text_delta", { text: event.text });
      } else if (event.type === "turn_complete") {
        turnResult = event.result;
      }
    }

    if (!turnResult) {
      return { ok: false, error: "Empty model response", status: 502 };
    }

    if (turnResult.toolCalls.length === 0) {
      emitLogicalTurn({ text: turnText || undefined });
      options.emit("done", {});
      return { ok: true, toolEvents, toolTurns };
    }

    const assistantMessage = buildAssistantToolUseMessage(turnResult);
    if (assistantMessage) {
      llmMessages.push(assistantMessage);
    }

    const toolResults: string[] = [];
    for (const call of turnResult.toolCalls) {
      if (projectFolderId) {
        const missing = checkProjectFolderExists(projectRoot, projectFolderId);
        if (missing) {
          return { ok: false, error: missing, status: 409 };
        }
      }

      // モデルの入力ゆらぎ（code の別名キー・run_script / run_skill_script の取り違え）を救済する
      if (isScriptToolName(call.name)) {
        const normalized = normalizeScriptToolCall(call.name, call.input ?? {});
        call.name = normalized.name;
        call.input = normalized.input;
      }

      options.emit("tool_start", {
        name: call.name,
        input: call.input,
        toolUseId: call.id,
      });
      toolEvents.push({
        phase: "start",
        name: call.name,
        input: call.input,
        toolUseId: call.id,
        display: call.name,
      });

      const broken = isBrokenToolUse(call);
      let outcome: ToolExecutionOutcome;

      // スクリプト系は確認ダイアログより先に事前検査する
      // （構文エラーや存在しないスクリプトの承認をユーザーに求めない）
      const preflight =
        !broken && toolContext && isScriptToolName(call.name)
          ? await preflightScriptToolCall(call.name, call.input, toolContext)
          : null;

      if (broken) {
        outcome = brokenToolOutcome(broken, {
          truncatedByMaxTokens: turnResult.stopReason === "max_tokens",
        });
      } else if (preflight) {
        outcome = preflight;
      } else {
        const requirement = toolContext
          ? resolveConfirmRequirement(
              toolContext.projectRoot,
              toolContext.projectFolderId,
              call,
              {
                ...skillOptions,
                skipOverwritePaths,
                searchUnavailable: !searchProvider || searchSession.unavailable,
              },
            )
          : null;

        if (requirement) {
          options.emit("confirm_required", {
            toolUseId: call.id,
            kind: requirement.kind,
            path: requirement.path,
            isNew: requirement.isNew,
            ...(requirement.script ? { script: requirement.script } : {}),
            ...(requirement.search ? { search: requirement.search } : {}),
          });
          const decision = await awaitToolConfirmDecision(call.id);
          if (decision === "reject") {
            outcome = {
              result: {
                rejected: true,
                path: requirement.path,
                reason: "ユーザーが確認ダイアログで拒否しました",
                ...(call.name === "web_search"
                  ? { guidance: SEARCH_REJECTED_GUIDANCE }
                  : {}),
              },
              display: {
                summary: "拒否",
                display: `✗ ユーザーが拒否: ${requirement.path}`,
              },
            };
          } else {
            if (requirement.kind === "overwrite") {
              skipOverwritePaths.add(normalizeConfirmPath(requirement.path));
            }
            outcome = await executeRegisteredTool(
              call.name,
              call.input,
              toolContext,
            );
          }
        } else {
          outcome = await executeRegisteredTool(
            call.name,
            call.input,
            toolContext,
          );
        }
      }

      const resultJson = JSON.stringify(outcome.result);
      toolResults.push(resultJson);

      if (!extractToolErrorMessage(outcome.result)) {
        for (const written of collectWrittenPathsFromToolResult(
          outcome.result,
        )) {
          skipOverwritePaths.add(written);
        }
      }

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

    emitLogicalTurn({
      text: turnText || undefined,
      toolCalls: turnResult.toolCalls.map((call, index) => ({
        id: call.id,
        name: call.name,
        input: call.input,
        result: toolResults[index] ?? "{}",
      })),
    });

    llmMessages.push(
      ...buildToolResultMessages(turnResult.toolCalls, toolResults),
    );
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
