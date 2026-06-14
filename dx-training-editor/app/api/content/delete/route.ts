import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir, findSeriesDir, findCourseDir } from "@/lib/contents-loader";
import { sanitizeFilename, stripPrefix } from "@/lib/content-filename";

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

function renumberItems(dir: string, ext: "" | ".md") {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => ext === "" ? e.isDirectory() : e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort((a, b) => {
      const na = parseInt(a.match(/^(\d+)/)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? "0", 10);
      return na - nb;
    });

  entries.forEach((oldName, i) => {
    const displayName = ext === "" ? stripPrefix(oldName) : stripPrefix(oldName);
    const newName = `${String(i + 1).padStart(2, "0")}_${displayName}${ext}`;
    if (oldName !== newName) {
      fs.renameSync(path.join(dir, oldName), path.join(dir, newName));
    }
  });
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
    const seriesDir = findSeriesDir(contentsDir, parsed.data.name);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    fs.rmSync(seriesDir, { recursive: true, force: true });
    // シリーズ削除後に残りフォルダのプレフィックスを振り直す
    renumberItems(contentsDir, "");
    return Response.json({ ok: true });
  }

  if (parsed.data.type === "course") {
    const seriesDirForCourse = findSeriesDir(contentsDir, parsed.data.series);
    if (!seriesDirForCourse) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const courseDir = findCourseDir(seriesDirForCourse, parsed.data.name);
    if (!courseDir) {
      return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
    }
    fs.rmSync(courseDir, { recursive: true, force: true });
    renumberItems(seriesDirForCourse, "");
    return Response.json({ ok: true });
  }

  // lesson
  const lessonData = parsed.data as { type: "lesson"; series: string; course: string; name: string };
  const lessonSeriesDir = findSeriesDir(contentsDir, lessonData.series);
  if (!lessonSeriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const lessonCourseDir = findCourseDir(lessonSeriesDir, lessonData.course);
  if (!lessonCourseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = lessonCourseDir;
  const lessonFiles = fs
    .readdirSync(courseDir)
    .filter((f) => f.endsWith(".md") && stripPrefix(f) === lessonData.name);
  if (lessonFiles.length === 0) {
    return Response.json({ error: "レッスンファイルが見つかりません" }, { status: 404 });
  }
  fs.unlinkSync(path.join(courseDir, lessonFiles[0]));
  renumberItems(courseDir, ".md");
  return Response.json({ ok: true });
}
