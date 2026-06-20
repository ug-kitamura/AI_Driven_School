import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  loadMeta,
  saveMeta,
  saveMandala,
} from "@/lib/contents-loader";
import { isValidSlug } from "@/lib/content-filename";
import { createLessonContentTemplate, normalizeLessonMeta } from "@/lib/lesson-frontmatter";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    slug: z.string().min(1),
    titleJa: z.string().min(1),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    slug: z.string().min(1),
    titleJa: z.string().min(1),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    slug: z.string().min(1),
    titleJa: z.string().min(1),
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

function appendToOrderJson(filePath: string, slug: string): void {
  const order = readOrderJson(filePath);
  if (!order.includes(slug)) {
    order.push(slug);
    fs.writeFileSync(filePath, JSON.stringify(order, null, 2), "utf-8");
  }
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
    const { slug, titleJa } = parsed.data;
    if (!isValidSlug(slug)) {
      return Response.json({ error: `スラッグ '${slug}' が不正です（英小文字・数字・ハイフンのみ、最大 50 文字）` }, { status: 400 });
    }
    const targetDir = path.join(contentsDir, slug);
    if (fs.existsSync(targetDir)) {
      return Response.json({ error: `スラッグ '${slug}' はすでに使われています` }, { status: 409 });
    }
    fs.mkdirSync(targetDir, { recursive: true });
    saveMeta(targetDir, { title: { ja: titleJa, en: null }, target_audience: { ja: "", en: null } });
    appendToOrderJson(path.join(contentsDir, "_series-order.json"), slug);
    return Response.json({ ok: true, slug });
  }

  if (parsed.data.type === "course") {
    const { series: seriesSlug, slug, titleJa } = parsed.data;
    if (!isValidSlug(slug)) {
      return Response.json({ error: `スラッグ '${slug}' が不正です` }, { status: 400 });
    }
    const seriesDir = findSeriesDir(contentsDir, seriesSlug);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const targetDir = path.join(seriesDir, slug);
    if (fs.existsSync(targetDir)) {
      return Response.json({ error: `スラッグ '${slug}' はすでに使われています` }, { status: 409 });
    }
    fs.mkdirSync(targetDir, { recursive: true });
    saveMeta(targetDir, { title: { ja: titleJa, en: null }, target_audience: { ja: "", en: null } });
    saveMandala(targetDir, { prerequisites: [], next_courses: [] });
    appendToOrderJson(path.join(seriesDir, "_course-order.json"), slug);
    return Response.json({ ok: true, slug });
  }

  // lesson
  const { series: seriesSlug, course: courseSlug, slug, titleJa } = parsed.data as {
    type: "lesson"; series: string; course: string; slug: string; titleJa: string;
  };
  if (!isValidSlug(slug)) {
    return Response.json({ error: `スラッグ '${slug}' が不正です` }, { status: 400 });
  }
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, courseSlug);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  const lessonFilePath = path.join(courseDir, `${slug}.md`);
  if (fs.existsSync(lessonFilePath)) {
    return Response.json({ error: `スラッグ '${slug}' はすでに使われています` }, { status: 409 });
  }
  const meta = normalizeLessonMeta(
    { lesson: slug, status: "open" },
    { seriesName: seriesSlug, courseName: courseSlug },
  );
  fs.writeFileSync(lessonFilePath, createLessonContentTemplate(meta), "utf-8");
  appendToOrderJson(path.join(courseDir, "_lesson-order.json"), slug);
  return Response.json({ ok: true, slug });
}
