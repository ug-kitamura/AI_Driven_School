import { z } from "zod";
import { getContentsDir, readMetaJson, writeMetaJson } from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";

/** 全体メタ（contents/.meta.json）の閲覧・編集。現時点の編集対象は description のみ */
export async function GET() {
  const contentsDir = getContentsDir(getProjectRoot());
  const meta = readMetaJson(contentsDir);
  return Response.json({
    description: typeof meta.description === "string" ? meta.description : "",
  });
}

const putSchema = z.object({
  description: z.string(),
});

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const contentsDir = getContentsDir(getProjectRoot());
  const meta = readMetaJson(contentsDir);
  const description = parsed.data.description.trim();
  if (description) {
    meta.description = description;
  } else {
    delete meta.description;
  }
  writeMetaJson(contentsDir, meta);
  return Response.json({ ok: true });
}
