import { z } from "zod";
import { resolveAiApiKey } from "@/lib/api-keys";
import {
  buildContextFormatMessages,
  parseContextFormatResponse,
} from "@/lib/context-format-prompt";
import { resolveAiModel } from "@/lib/resolve-ai-model";

const bodySchema = z.object({
  rawText: z.string().trim().min(1),
  existingTags: z.array(z.string().trim().min(1)).optional(),
});

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const data = (await res.json()) as {
    error?: { type?: string; message?: string };
    content?: Array<{ type: string; text?: string }>;
  };

  if (!res.ok) {
    const apiMessage = data.error?.message?.trim();
    const apiType = data.error?.type?.trim();
    const detail =
      apiMessage && apiType && !apiMessage.includes(apiType)
        ? `${apiType}: ${apiMessage}`
        : apiMessage || apiType;
    throw new Error(detail ?? "Claude API error");
  }

  const text = data.content
    ?.filter((chunk) => chunk.type === "text")
    .map((chunk) => chunk.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("empty Claude response");
  return text;
}

export async function POST(req: Request) {
  const apiKey = resolveAiApiKey(req);
  if (!apiKey) {
    return Response.json(
      {
        error:
          "AI API キーが未設定です。設定ダイアログから入力するか、`.env.local` に AI_API_KEY を設定してください。",
      },
      { status: 401 },
    );
  }

  const modelResult = resolveAiModel(req);
  if (!modelResult.ok) {
    return Response.json({ error: modelResult.error }, { status: 400 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json: unknown = await req.json();
    parsed = bodySchema.parse(json);
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const { system, user } = buildContextFormatMessages(
    parsed.rawText,
    parsed.existingTags ?? [],
  );

  try {
    const raw = await callClaude(apiKey, modelResult.model, system, user);
    const formatted = parseContextFormatResponse(raw);
    if (!formatted) {
      return Response.json({ error: "整形結果を解析できませんでした" }, { status: 502 });
    }
    return Response.json(formatted);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 整形に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
