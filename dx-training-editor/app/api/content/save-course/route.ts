import { z } from "zod";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  readMetaJson,
  writeMetaJson,
} from "@/lib/contents-loader";

const schema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  target: z.string().default(""),
  prerequisites: z.array(z.string()).default([]),
  next_courses: z.array(z.string()).default([]),
});

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

  const { series, course, target, prerequisites, next_courses } = parsed.data;
  const contentsDir = getContentsDir(process.cwd());
  const seriesDir = findSeriesDir(contentsDir, series);
  if (!seriesDir) {
    return Response.json({ error: `シリーズフォルダが見つかりません: ${series}` }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, course);
  if (!courseDir) {
    return Response.json({ error: `コースフォルダが見つかりません: ${course}` }, { status: 404 });
  }

  try {
    const existing = readMetaJson(courseDir);
    const { target_audience: _legacy, ...rest } = existing as Record<string, unknown> & { target_audience?: unknown };
    writeMetaJson(courseDir, { ...rest, target, prerequisites, next_courses });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
