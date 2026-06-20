import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir, findSeriesDir, findCourseDir } from "@/lib/contents-loader";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    slug: z.string().min(1),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    slug: z.string().min(1),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    slug: z.string().min(1),
  }),
]);

function readOrderJson(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as string[];
  } catch {
    return [];
  }
}

function removeFromOrderJson(filePath: string, slug: string): void {
  const order = readOrderJson(filePath).filter((s) => s !== slug);
  fs.writeFileSync(filePath, JSON.stringify(order, null, 2), "utf-8");
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

  const contentsDir = getContentsDir(process.cwd());

  if (parsed.data.type === "series") {
    const { slug } = parsed.data;
    const seriesDir = path.join(contentsDir, slug);
    if (!fs.existsSync(seriesDir)) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    fs.rmSync(seriesDir, { recursive: true, force: true });
    removeFromOrderJson(path.join(contentsDir, "_series-order.json"), slug);
    return Response.json({ ok: true });
  }

  if (parsed.data.type === "course") {
    const { series: seriesSlug, slug } = parsed.data;
    const seriesDir = findSeriesDir(contentsDir, seriesSlug);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const courseDir = path.join(seriesDir, slug);
    if (!fs.existsSync(courseDir)) {
      return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
    }
    fs.rmSync(courseDir, { recursive: true, force: true });
    removeFromOrderJson(path.join(seriesDir, "_course-order.json"), slug);
    return Response.json({ ok: true });
  }

  // lesson
  const { series: seriesSlug, course: courseSlug, slug } = parsed.data as {
    type: "lesson"; series: string; course: string; slug: string;
  };
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, courseSlug);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  const lessonFilePath = path.join(courseDir, `${slug}.md`);
  if (!fs.existsSync(lessonFilePath)) {
    return Response.json({ error: "レッスンファイルが見つかりません" }, { status: 404 });
  }
  fs.unlinkSync(lessonFilePath);
  // 英語版も存在すれば削除
  const enFilePath = path.join(courseDir, `${slug}.en.md`);
  if (fs.existsSync(enFilePath)) fs.unlinkSync(enFilePath);
  removeFromOrderJson(path.join(courseDir, "_lesson-order.json"), slug);
  return Response.json({ ok: true });
}
