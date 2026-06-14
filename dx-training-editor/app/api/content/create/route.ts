import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir, findSeriesDir, findCourseDir } from "@/lib/contents-loader";
import { withPrefix } from "@/lib/content-filename";
import { createLessonContentTemplate, normalizeLessonMeta } from "@/lib/lesson-frontmatter";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    name: z.string().min(1),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    name: z.string().min(1),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    name: z.string().min(1),
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
    fs.mkdirSync(contentsDir, { recursive: true });
    const existingCount = fs
      .readdirSync(contentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory()).length;
    const dirName = withPrefix(existingCount, parsed.data.name);
    fs.mkdirSync(path.join(contentsDir, dirName), { recursive: true });
    return Response.json({ ok: true, dirName });
  }

  if (parsed.data.type === "course") {
    const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
    if (!seriesDir) {
      return Response.json({ error: `シリーズフォルダが見つかりません` }, { status: 404 });
    }
    const existingCourses = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory()).length;
    const courseDirName = withPrefix(existingCourses, parsed.data.name);
    const courseDir = path.join(seriesDir, courseDirName);
    fs.mkdirSync(courseDir, { recursive: true });
    fs.writeFileSync(
      path.join(courseDir, ".meta.json"),
      JSON.stringify({ target_audience: "", prerequisites: [], next_courses: [] }, null, 2),
      "utf-8",
    );
    return Response.json({ ok: true, dirName: courseDirName });
  }

  // lesson
  const lessonData = parsed.data as { type: "lesson"; series: string; course: string; name: string };
  const seriesDir = findSeriesDir(contentsDir, lessonData.series);
  if (!seriesDir) {
    return Response.json({ error: `シリーズフォルダが見つかりません` }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, lessonData.course);
  if (!courseDir) {
    return Response.json({ error: `コースフォルダが見つかりません` }, { status: 404 });
  }
  const existingLessons = fs
    .readdirSync(courseDir)
    .filter((f) => f.endsWith(".md")).length;
  const lessonFileName = `${withPrefix(existingLessons, lessonData.name)}.md`;
  const meta = normalizeLessonMeta(
    { lesson: lessonData.name, status: "open" },
    { seriesName: lessonData.series, courseName: lessonData.course },
  );
  fs.writeFileSync(
    path.join(courseDir, lessonFileName),
    createLessonContentTemplate(meta),
    "utf-8",
  );
  return Response.json({ ok: true, fileName: lessonFileName });
}
