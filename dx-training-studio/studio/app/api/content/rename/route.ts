import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  readMetaJson,
  writeMetaJson,
} from "@/lib/contents-loader";
import { sanitizeFilename } from "@/lib/content-filename";
import {
  parseLessonDocument,
  serializeLessonDocument,
  normalizeLessonMeta,
} from "@/lib/lesson-frontmatter";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    oldName: z.string().min(1),
    newName: z.string().min(1),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    oldName: z.string().min(1),
    newName: z.string().min(1),
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
    const oldDir = path.join(contentsDir, parsed.data.oldName);
    if (!fs.existsSync(oldDir)) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const newDirName = sanitizeFilename(parsed.data.newName);
    const newDir = path.join(contentsDir, newDirName);
    fs.renameSync(oldDir, newDir);

    // contents/.meta.json の order を in-place 更新
    const meta = readMetaJson(contentsDir);
    if (Array.isArray(meta.order)) {
      meta.order = (meta.order as string[]).map((n) =>
        n === parsed.data.oldName ? newDirName : n,
      );
      writeMetaJson(contentsDir, meta);
    }
    return Response.json({ ok: true });
  }

  if (parsed.data.type === "course") {
    const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const oldDir = path.join(seriesDir, parsed.data.oldName);
    if (!fs.existsSync(oldDir)) {
      return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
    }
    const newDirName = sanitizeFilename(parsed.data.newName);
    const newDir = path.join(seriesDir, newDirName);
    fs.renameSync(oldDir, newDir);

    // series/.meta.json の order を in-place 更新
    const meta = readMetaJson(seriesDir);
    if (Array.isArray(meta.order)) {
      meta.order = (meta.order as string[]).map((n) =>
        n === parsed.data.oldName ? newDirName : n,
      );
      writeMetaJson(seriesDir, meta);
    }
    return Response.json({ ok: true });
  }

  // lesson
  const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, parsed.data.course);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }

  const oldLessonDir = path.join(courseDir, parsed.data.oldName);
  const oldContentsPath = path.join(oldLessonDir, "contents.md");
  const newDirName = sanitizeFilename(parsed.data.newName);
  const newLessonDir = path.join(courseDir, newDirName);

  if (!fs.existsSync(oldContentsPath)) {
    return Response.json({ error: "レッスンフォルダが見つかりません" }, { status: 404 });
  }

  const content = fs.readFileSync(oldContentsPath, "utf-8");
  const { meta, body: lessonBody } = parseLessonDocument(content);
  const normalized = normalizeLessonMeta(
    { ...meta, lesson: parsed.data.newName },
    { seriesName: parsed.data.series, courseName: parsed.data.course },
  );
  fs.writeFileSync(
    oldContentsPath,
    serializeLessonDocument(normalized, lessonBody),
    "utf-8",
  );
  fs.renameSync(oldLessonDir, newLessonDir);

  // course/.meta.json の order を in-place 更新
  const courseMeta = readMetaJson(courseDir);
  if (Array.isArray(courseMeta.order)) {
    courseMeta.order = (courseMeta.order as string[]).map((n) =>
      n === parsed.data.oldName ? newDirName : n,
    );
    writeMetaJson(courseDir, courseMeta);
  }

  return Response.json({ ok: true });
}
