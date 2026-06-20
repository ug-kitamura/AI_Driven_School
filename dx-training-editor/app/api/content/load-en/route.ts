import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getContentsDir, findSeriesDir, findCourseDir } from "@/lib/contents-loader";

const schema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  lesson: z.string().min(1),
});

function sha256Hex(text: string): string {
  return "sha256:" + crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

function extractFrontmatter(content: string): { sourceHash?: string; generatedAt?: string; body: string } {
  if (!content.startsWith("---")) return { body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { body: content };
  const fmText = content.slice(3, end).trim();
  const body = content.slice(end + 4).trimStart();
  const sourceHashMatch = fmText.match(/^source_hash:\s*(.+)$/m);
  const generatedAtMatch = fmText.match(/^generated_at:\s*(.+)$/m);
  return {
    sourceHash: sourceHashMatch?.[1]?.trim(),
    generatedAt: generatedAtMatch?.[1]?.trim(),
    body,
  };
}

export async function POST(req: Request) {
  let reqBody: unknown;
  try {
    reqBody = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = schema.safeParse(reqBody);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const { series: seriesSlug, course: courseSlug, lesson: lessonSlug } = parsed.data;
  const contentsDir = getContentsDir(process.cwd());
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, courseSlug);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }

  const enFilePath = path.join(courseDir, `${lessonSlug}.en.md`);
  const jaFilePath = path.join(courseDir, `${lessonSlug}.md`);

  // 日本語版の現在のハッシュを計算
  const jaCurrentHash = fs.existsSync(jaFilePath)
    ? sha256Hex(fs.readFileSync(jaFilePath, "utf-8"))
    : null;

  if (!fs.existsSync(enFilePath)) {
    return Response.json({ exists: false, jaCurrentHash });
  }

  const rawContent = fs.readFileSync(enFilePath, "utf-8");
  const { sourceHash, generatedAt, body: enBody } = extractFrontmatter(rawContent);

  const isStale = sourceHash != null && jaCurrentHash != null && sourceHash !== jaCurrentHash;

  return Response.json({
    exists: true,
    content: enBody,
    sourceHash,
    generatedAt,
    jaCurrentHash,
    isStale,
  });
}
