"use client";

import type { AgentLogicalTurn, AgentToolEvent } from "@/lib/agent/llm/types";

export type ToolConfirmKind =
  | "overwrite"
  | "outside-project-read"
  | "outside-project-write";

export type ToolConfirmRequiredEvent = {
  toolUseId: string;
  kind: ToolConfirmKind;
  path: string;
  isNew: boolean;
};

export type AgentStreamCallbacks = {
  onDelta: (text: string) => void;
  onToolStart?: (event: AgentToolEvent) => void;
  onToolEnd?: (event: AgentToolEvent) => void;
  onLogicalTurn?: (turn: AgentLogicalTurn) => void;
  onConfirmRequired?: (event: ToolConfirmRequiredEvent) => void;
};

/**
 * Agent invoke SSE parser (text_delta / tool_start / tool_end / logical_turn / done / error).
 */
export async function consumeAgentStream(
  response: Response,
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.body) {
    throw new Error("empty response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const throwIfAborted = () => {
    if (signal?.aborted) {
      void reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
  };

  try {
    while (true) {
      throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        throwIfAborted();
        const lines = chunk.split("\n");
        const eventLine = lines.find((line) => line.startsWith("event: "));
        const dataLine = lines.find((line) => line.startsWith("data: "));
        if (!eventLine || !dataLine) continue;

        const eventName = eventLine.slice("event: ".length).trim();
        const payload = dataLine.slice("data: ".length).trim();
        if (!payload) continue;

        let data: Record<string, unknown>;
        try {
          data = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          continue;
        }

        switch (eventName) {
          case "text_delta": {
            const text = typeof data.text === "string" ? data.text : "";
            if (text) callbacks.onDelta(text);
            break;
          }
          case "tool_start":
            callbacks.onToolStart?.({
              phase: "start",
              name: String(data.name ?? ""),
              input:
                data.input && typeof data.input === "object"
                  ? (data.input as Record<string, unknown>)
                  : undefined,
              toolUseId: typeof data.toolUseId === "string" ? data.toolUseId : undefined,
              display: String(data.display ?? data.name ?? ""),
            });
            break;
          case "tool_end":
            callbacks.onToolEnd?.({
              phase: "end",
              name: String(data.name ?? ""),
              toolUseId: typeof data.toolUseId === "string" ? data.toolUseId : undefined,
              summary: typeof data.summary === "string" ? data.summary : undefined,
              display: String(data.display ?? data.name ?? ""),
              result: typeof data.result === "string" ? data.result : undefined,
              tags: Array.isArray(data.tags)
                ? data.tags.filter((tag): tag is string => typeof tag === "string")
                : undefined,
            });
            break;
          case "logical_turn": {
            const text = typeof data.text === "string" ? data.text : undefined;
            const rawCalls = Array.isArray(data.toolCalls) ? data.toolCalls : [];
            const toolCalls = rawCalls
              .map((item) => {
                if (!item || typeof item !== "object") return null;
                const call = item as Record<string, unknown>;
                if (
                  typeof call.id !== "string" ||
                  typeof call.name !== "string" ||
                  typeof call.result !== "string"
                ) {
                  return null;
                }
                return {
                  id: call.id,
                  name: call.name,
                  input:
                    call.input && typeof call.input === "object"
                      ? (call.input as Record<string, unknown>)
                      : {},
                  result: call.result,
                };
              })
              .filter((call): call is NonNullable<typeof call> => call !== null);
            callbacks.onLogicalTurn?.({
              ...(text ? { text } : {}),
              ...(toolCalls.length > 0 ? { toolCalls } : {}),
            });
            break;
          }
          case "confirm_required": {
            const kind = data.kind;
            if (
              typeof data.toolUseId === "string" &&
              (kind === "overwrite" ||
                kind === "outside-project-read" ||
                kind === "outside-project-write") &&
              typeof data.path === "string"
            ) {
              callbacks.onConfirmRequired?.({
                toolUseId: data.toolUseId,
                kind,
                path: data.path,
                isNew: Boolean(data.isNew),
              });
            }
            break;
          }
          case "error": {
            const message =
              typeof data.message === "string" ? data.message : "スキル実行に失敗しました";
            throw new Error(message);
          }
          case "done":
            return;
          default:
            break;
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => undefined);
      throw new DOMException("Aborted", "AbortError");
    }
    throw error;
  }
}

/** @deprecated use consumeAgentStream */
export async function consumeAnthropicStream(
  response: Response,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  return consumeAgentStream(response, { onDelta }, signal);
}
