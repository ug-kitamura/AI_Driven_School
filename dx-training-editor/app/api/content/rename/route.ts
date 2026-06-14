import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir, findSeriesDir, findCourseDir } from "@/lib/contents-loader";
import { sanitizeFilename, stripPrefix } from "@/lib/content-filename";
import { parseLessonDocument, serializeLessonDocument, normalizeLessonMeta } from "@/lib/lesson-frontmatter";

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
    const seriesDirs = fs
      .readdirSync(contentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && stripPrefix(e.name) === parsed.data.oldName);
    if (seriesDirs.length === 0) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const oldDirName = seriesDirs[0].name;
    const prefix = oldDirName.match(/^(\d+_)/)?.[1] ?? "";
    const newDirName = `${prefix}${sanitizeFilename(parsed.data.newName)}`;
    fs.renameSync(path.join(contentsDir, oldDirName), path.join(contentsDir, newDirName));
    return Response.json({ ok: true });
  }

  if (parsed.data.type === "course") {
    const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const courseDirs = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && stripPrefix(e.name) === parsed.data.oldName);
    if (courseDirs.length === 0) {
      return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
    }
    const oldDirName = courseDirs[0].name;
    const prefix = oldDirName.match(/^(\d+_)/)?.[1] ?? "";
    const newDirName = `${prefix}${sanitizeFilename(parsed.data.newName)}`;
    fs.renameSync(path.join(seriesDir, oldDirName), path.join(seriesDir, newDirName));
    return Response.json({ ok: true });
  }

  // lesson
  const lessonData = parsed.data as {
    type: "lesson";
    series: string;
    course: string;
    oldName: string;
    newName: string;
  };
  const seriesDir = findSeriesDir(contentsDir, lessonData.series);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, lessonData.course);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  const lessonFiles = fs
    .readdirSync(courseDir)
    .filter((f) => f.endsWith(".md") && stripPrefix(f) === lessonData.oldName);
  if (lessonFiles.length === 0) {
    return Response.json({ error: "レッスンファイルが見つかりません" }, { status: 404 });
  }
  const oldFileName = lessonFiles[0];
  const prefix = oldFileName.match(/^(\d+_)/)?.[1] ?? "";
  const newFileName = `${prefix}${sanitizeFilename(lessonData.newName)}.md`;
  const oldFilePath = path.join(courseDir, oldFileName);
  const newFilePath = path.join(courseDir, newFileName);

  const content = fs.readFileSync(oldFilePath, "utf-8");
  const { meta, body: lessonBody } = parseLessonDocument(content);
  const normalized = normalizeLessonMeta(
    { ...meta, lesson: lessonData.newName },
    { seriesName: lessonData.series, courseName: lessonData.course },
  );
  fs.writeFileSync(oldFilePath, serializeLessonDocument(normalized, lessonBody), "utf-8");
  fs.renameSync(oldFilePath, newFilePath);

  return Response.json({ ok: true });
}
