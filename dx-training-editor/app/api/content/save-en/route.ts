import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getContentsDir, findSeriesDir, findCourseDir } from "@/lib/contents-loader";

const schema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  lesson: z.string().min(1),
  content: z.string(),
  /** 省略時は source_hash を現在の日本語ファイルから自動計算する */
  sourceHash: z.string().optional(),
});

function sha256Hex(text: string): string {
  return "sha256:" + crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

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

  const { series: seriesSlug, course: courseSlug, lesson: lessonSlug, content } = parsed.data;
  const contentsDir = getContentsDir(process.cwd());
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, courseSlug);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }

  // 日本語版のハッシュを計算
  const jaFilePath = path.join(courseDir, `${lessonSlug}.md`);
  let sourceHash = parsed.data.sourceHash;
  if (!sourceHash) {
    if (fs.existsSync(jaFilePath)) {
      const jaContent = fs.readFileSync(jaFilePath, "utf-8");
      sourceHash = sha256Hex(jaContent);
    } else {
      sourceHash = sha256Hex("");
    }
  }

  const generatedAt = new Date().toISOString();

  // フロントマターを付与して保存
  const frontmatter = `---\nsource_hash: ${sourceHash}\ngenerated_at: ${generatedAt}\n---\n\n`;
  const bodyContent = content.startsWith("---") ? content : frontmatter + content;

  const enFilePath = path.join(courseDir, `${lessonSlug}.en.md`);
  fs.writeFileSync(enFilePath, bodyContent, "utf-8");

  return Response.json({ ok: true, sourceHash, generatedAt });
}
