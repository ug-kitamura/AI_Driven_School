import { resolveAiApiKey } from "@/lib/api-keys";

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const AI_KEY_ERROR =
  "AI API キーを設定（歯車）するか、サーバーに AI_API_KEY を設定してください";

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

export function resolveAnthropicModel(): string {
  return process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
}

export async function streamAnthropicMessages(options: {
  req: Request;
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}): Promise<Response> {
  const apiKey = resolveAiApiKey(options.req);
  if (!apiKey) {
    return Response.json({ error: AI_KEY_ERROR }, { status: 401 });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: resolveAnthropicModel(),
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
