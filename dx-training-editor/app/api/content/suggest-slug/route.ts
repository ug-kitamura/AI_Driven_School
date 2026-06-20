import { z } from "zod";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";
import { slugify } from "@/lib/content-filename";

const schema = z.object({
  title: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const { title } = parsed.data;

  // workspace 設定の AI API キーが設定されていれば AI 生成を試みる
  const settings = loadWorkspaceSettings();
  const apiKey = settings.aiApiKey ?? process.env.AI_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 50,
          messages: [
            {
              role: "user",
              content: `Convert the following Japanese title to an English kebab-case slug (lowercase letters, numbers, hyphens only, max 50 chars). Reply with ONLY the slug, no explanation.\n\nTitle: ${title}`,
            },
          ],
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { content?: Array<{ text?: string }> };
        const rawSlug = data.content?.[0]?.text?.trim() ?? "";
        // バリデーション + クリーニング
        const cleaned = rawSlug
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 50);
        if (cleaned) {
          return Response.json({ slug: cleaned });
        }
      }
    } catch {
      // AI 失敗時はフォールバック
    }
  }

  // フォールバック: slugify でローカル変換
  const fallback = slugify(title) || "new-item";
  return Response.json({ slug: fallback });
}
