import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir } from "@/lib/contents-loader";
import { sanitizeFilename, stripPrefix, withPrefix } from "@/lib/content-filename";
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
    const dirName = sanitizeFilename(parsed.data.name);
    fs.mkdirSync(path.join(contentsDir, dirName), { recursive: true });

    const orderFile = path.join(contentsDir, "_series-order.json");
    const order: string[] = fs.existsSync(orderFile)
      ? (JSON.parse(fs.readFileSync(orderFile, "utf-8")) as string[])
      : [];
    order.push(parsed.data.name);
    fs.writeFileSync(orderFile, JSON.stringify(order, null, 2), "utf-8");

    return Response.json({ ok: true });
  }

  if (parsed.data.type === "course") {
    const seriesDir = path.join(contentsDir, sanitizeFilename(parsed.data.series));
    if (!fs.existsSync(seriesDir)) {
      return Response.json({ error: `シリーズフォルダが見つかりません` }, { status: 404 });
    }
    const existingCourses = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .length;
    const courseDirName = withPrefix(existingCourses, parsed.data.name);
    const courseDir = path.join(seriesDir, courseDirName);
    fs.mkdirSync(courseDir, { recursive: true });
    fs.writeFileSync(
      path.join(courseDir, "_course.json"),
      JSON.stringify({ target_audience: "", prerequisites: [], next_courses: [] }, null, 2),
      "utf-8",
    );
    return Response.json({ ok: true, dirName: courseDirName });
  }

  // lesson
  const lessonData = parsed.data as { type: "lesson"; series: string; course: string; name: string };
  const seriesDir = path.join(contentsDir, sanitizeFilename(lessonData.series));
  const courseDirs = fs
    .readdirSync(seriesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && stripPrefix(e.name) === lessonData.course);
  if (courseDirs.length === 0) {
    return Response.json({ error: `コースフォルダが見つかりません` }, { status: 404 });
  }
  const courseDir = path.join(seriesDir, courseDirs[0].name);
  const existingLessons = fs
    .readdirSync(courseDir)
    .filter((f) => f.endsWith(".md"))
    .length;
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
