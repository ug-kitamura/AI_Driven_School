"use client";

import type { AgentToolEvent } from "@/lib/agent/llm/types";

export type AgentStreamCallbacks = {
  onDelta: (text: string) => void;
  onToolStart?: (event: AgentToolEvent) => void;
  onToolEnd?: (event: AgentToolEvent) => void;
};

/**
 * Agent invoke SSE parser (text_delta / tool_start / tool_end / done / error).
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
