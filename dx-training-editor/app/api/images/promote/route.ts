import { z } from "zod";
import { promoteStagingImage } from "@/lib/image-store";

const requestSchema = z.object({
  stagingPath: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  try {
    const file = await promoteStagingImage(process.cwd(), parsed.data.stagingPath);
    return Response.json({ file });
  } catch (error) {
    const message = error instanceof Error ? error.message : "promote に失敗しました";
    const status = message.includes("not found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
