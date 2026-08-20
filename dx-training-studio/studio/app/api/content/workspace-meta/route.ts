import { z } from "zod";
import { getContentsDir, readMetaJson, writeMetaJson } from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";

function readString(meta: Record<string, unknown>, key: string): string {
  const value = meta[key];
  return typeof value === "string" ? value : "";
}

/** 全体メタ（contents/.meta.json）の閲覧・編集（name / description / hero / github_url） */
export async function GET() {
  const contentsDir = getContentsDir(getProjectRoot());
  const meta = readMetaJson(contentsDir);
  return Response.json({
    name: readString(meta, "name"),
    description: readString(meta, "description"),
    hero: readString(meta, "hero"),
    github_url: readString(meta, "github_url"),
  });
}

const putSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  /** 正本 `images/<file>` のファイル名 */
  hero: z.string().optional(),
  github_url: z.url("GitHub リンクは URL 形式で入力してください").or(z.literal("")).optional(),
});

/** 「省略＝保全 / 空文字＝削除 / 値＝設定」。他の既存フィールド（order / _en 系等）は保全する */
export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const contentsDir = getContentsDir(getProjectRoot());
  const meta = readMetaJson(contentsDir);
  const apply = (key: "name" | "description" | "hero" | "github_url") => {
    const value = parsed.data[key];
    if (value === undefined) return;
    const trimmed = value.trim();
    if (trimmed) {
      meta[key] = trimmed;
    } else {
      delete meta[key];
    }
  };
  apply("name");
  apply("description");
  apply("hero");
  apply("github_url");
  writeMetaJson(contentsDir, meta);
  return Response.json({ ok: true });
}
