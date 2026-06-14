import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir } from "@/lib/contents-loader";
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
    const oldDir = path.join(contentsDir, sanitizeFilename(parsed.data.oldName));
    const newDir = path.join(contentsDir, sanitizeFilename(parsed.data.newName));
    if (!fs.existsSync(oldDir)) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    fs.renameSync(oldDir, newDir);

    const orderFile = path.join(contentsDir, "_series-order.json");
    if (fs.existsSync(orderFile)) {
      const order = JSON.parse(fs.readFileSync(orderFile, "utf-8")) as string[];
      const updated = order.map((n) => (n === parsed.data.oldName ? parsed.data.newName : n));
      fs.writeFileSync(orderFile, JSON.stringify(updated, null, 2), "utf-8");
    }
    return Response.json({ ok: true });
  }

  if (parsed.data.type === "course") {
    const seriesDir = path.join(contentsDir, sanitizeFilename(parsed.data.series));
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
  const seriesDir = path.join(contentsDir, sanitizeFilename(lessonData.series));
  const courseDirs = fs
    .readdirSync(seriesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && stripPrefix(e.name) === lessonData.course);
  if (courseDirs.length === 0) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = path.join(seriesDir, courseDirs[0].name);
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

  // フロントマターの lesson: フィールドも更新する
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
