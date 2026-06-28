import type { LlmContentBlock } from "@/lib/agent/llm/types";

export type InvokeChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolEvents?: Array<{
    name: string;
    phase: "start" | "end";
    toolUseId?: string;
    input?: Record<string, unknown>;
    summary?: string;
    display: string;
    result?: string;
    tags?: string[];
  }>;
};

export function clientMessagesToLlmMessages(messages: InvokeChatMessage[]) {
  const llmMessages: Array<{ role: "user" | "assistant"; content: string | LlmContentBlock[] }> =
    [];

  for (const message of messages) {
    if (message.role === "user") {
      llmMessages.push({ role: "user", content: message.content });
      continue;
    }

    const toolEvents = message.toolEvents ?? [];
    const starts = toolEvents.filter((event) => event.phase === "start");
    const ends = toolEvents.filter((event) => event.phase === "end");
    const assistantBlocks: LlmContentBlock[] = [];

    if (message.content.trim()) {
      assistantBlocks.push({ type: "text", text: message.content });
    }

    for (const end of ends) {
      const start = starts.find((event) => event.toolUseId === end.toolUseId);
      if (!start?.toolUseId) continue;
      assistantBlocks.push({
        type: "tool_use",
        id: start.toolUseId,
        name: start.name,
        input: start.input ?? {},
      });
    }

    if (assistantBlocks.length === 0) {
      llmMessages.push({ role: "assistant", content: message.content || " " });
    } else {
      llmMessages.push({ role: "assistant", content: assistantBlocks });
    }

    const toolResults = ends
      .filter((event) => event.toolUseId && event.result)
      .map((event) => ({
        type: "tool_result" as const,
        tool_use_id: event.toolUseId!,
        content: event.result!,
      }));

    if (toolResults.length > 0) {
      llmMessages.push({ role: "user", content: toolResults });
    }
  }

  return llmMessages;
}
