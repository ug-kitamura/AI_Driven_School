import { z } from "zod";
import { resolveAiApiKey } from "@/lib/api-keys";
import {
  buildWebSuggestPromptMessages,
  parseWebSuggestPromptResponse,
} from "@/lib/web-image-suggest-prompt";
import { lessonSchema } from "@/lib/schema";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const bodySchema = z.object({
  lesson: lessonSchema,
  cursorOffset: z.number().int().min(0).optional(),
  seedPrompt: z.string().optional(),
});

async function callClaude(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? DEFAULT_MODEL,
      max_tokens: 2048,
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
    ?.filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("empty Claude response");
  return text;
}

export async function POST(req: Request) {
  const apiKey = resolveAiApiKey(req);
  if (!apiKey) {
    return Response.json(
      { error: "AI API キーが未設定です。`.env.local` の AI_API_KEY または設定ダイアログから入力してください。" },
      { status: 401 },
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json: unknown = await req.json();
    parsed = bodySchema.parse(json);
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const cursorOffset = parsed.cursorOffset ?? 0;
  const { system, user } = buildWebSuggestPromptMessages(
    parsed.lesson,
    cursorOffset,
    parsed.seedPrompt,
  );

  try {
    const raw = await callClaude(apiKey, system, user);
    const prompt = parseWebSuggestPromptResponse(raw);
    if (!prompt) {
      return Response.json({ error: "プロンプトを生成できませんでした" }, { status: 502 });
    }
    return Response.json({ prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "プロンプト生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
