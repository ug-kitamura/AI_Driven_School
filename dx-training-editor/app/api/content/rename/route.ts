import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  loadMeta,
  saveMeta,
} from "@/lib/contents-loader";
import { parseLessonDocument, serializeLessonDocument, normalizeLessonMeta } from "@/lib/lesson-frontmatter";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    slug: z.string().min(1),
    newTitleJa: z.string().min(1),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    slug: z.string().min(1),
    newTitleJa: z.string().min(1),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    oldName: z.string().min(1),
    newName: z.string().min(1),
  }),
]);

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
    const { slug, newTitleJa } = parsed.data;
    const seriesDir = path.join(contentsDir, slug);
    if (!fs.existsSync(seriesDir)) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const meta = loadMeta(seriesDir) ?? { title: { ja: slug, en: null } };
    saveMeta(seriesDir, { ...meta, title: { ...meta.title, ja: newTitleJa } });
    return Response.json({ ok: true });
  }

  if (parsed.data.type === "course") {
    const { series: seriesSlug, slug, newTitleJa } = parsed.data;
    const seriesDir = findSeriesDir(contentsDir, seriesSlug);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const courseDir = path.join(seriesDir, slug);
    if (!fs.existsSync(courseDir)) {
      return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
    }
    const meta = loadMeta(courseDir) ?? { title: { ja: slug, en: null } };
    saveMeta(courseDir, { ...meta, title: { ...meta.title, ja: newTitleJa } });
    return Response.json({ ok: true });
  }

  // lesson: スラッグベースのシステムでもフロントマター経由の lesson 名変更を維持する
  const { series: seriesSlug, course: courseSlug, oldName, newName } = parsed.data as {
    type: "lesson"; series: string; course: string; oldName: string; newName: string;
  };
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, courseSlug);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  const oldFilePath = path.join(courseDir, `${oldName}.md`);
  const newFilePath = path.join(courseDir, `${newName}.md`);
  if (!fs.existsSync(oldFilePath)) {
    return Response.json({ error: "レッスンファイルが見つかりません" }, { status: 404 });
  }
  const content = fs.readFileSync(oldFilePath, "utf-8");
  const { meta, body: lessonBody } = parseLessonDocument(content);
  const normalized = normalizeLessonMeta(
    { ...meta, lesson: newName },
    { seriesName: seriesSlug, courseName: courseSlug },
  );
  fs.writeFileSync(oldFilePath, serializeLessonDocument(normalized, lessonBody), "utf-8");
  if (oldName !== newName) {
    fs.renameSync(oldFilePath, newFilePath);
    // 順序 JSON も更新
    const lessonOrderPath = path.join(courseDir, "_lesson-order.json");
    if (fs.existsSync(lessonOrderPath)) {
      const order: string[] = JSON.parse(fs.readFileSync(lessonOrderPath, "utf-8")) as string[];
      const updated = order.map((s) => (s === oldName ? newName : s));
      fs.writeFileSync(lessonOrderPath, JSON.stringify(updated, null, 2), "utf-8");
    }
  }
  return Response.json({ ok: true });
}
