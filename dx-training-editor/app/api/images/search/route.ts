import { z } from "zod";
import { resolveAnthropicApiKey, resolvePixabayApiKey } from "@/lib/api-keys";
import { lessonSchema } from "@/lib/schema";
import { executeWebImageSearch } from "@/lib/web-image-search";
import {
  buildWebSearchPlanMessages,
  parseWebSearchPlanResponse,
} from "@/lib/web-image-search-plan";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const bodySchema = z.object({
  lesson: lessonSchema,
  prompt: z.string().min(1),
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
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
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
  const anthropicKey = resolveAnthropicApiKey(req);
  if (!anthropicKey) {
    return Response.json(
      { error: "Anthropic API キーが未設定です。設定ダイアログから入力してください。" },
      { status: 401 },
    );
  }

  const pixabayKey = resolvePixabayApiKey(req);
  if (!pixabayKey) {
    return Response.json(
      { error: "Pixabay API キーが未設定です。設定ダイアログから入力してください。" },
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

  const { system, user } = buildWebSearchPlanMessages(parsed.lesson, parsed.prompt.trim());

  let plan: ReturnType<typeof parseWebSearchPlanResponse>;
  try {
    const raw = await callClaude(anthropicKey, system, user);
    plan = parseWebSearchPlanResponse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "検索計画の生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }

  try {
    const results = await executeWebImageSearch(process.cwd(), pixabayKey, plan);
    if (results.length === 0) {
      return Response.json(
        { error: "条件に合う画像が見つかりませんでした。プロンプトを変えて再試行してください。" },
        { status: 404 },
      );
    }
    return Response.json({
      results: results.map(({ file, alt }) => ({ file, alt })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "画像の検索に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
