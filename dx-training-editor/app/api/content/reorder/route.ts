import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir, findSeriesDir, findCourseDir } from "@/lib/contents-loader";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    /** 新しい順序のコーススラッグリスト */
    newOrder: z.array(z.string()),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    /** 新しい順序のレッスンスラッグリスト */
    newOrder: z.array(z.string()),
  }),
]);

function writeOrderJson(filePath: string, order: string[]): void {
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

  if (parsed.data.type === "course") {
    const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    writeOrderJson(path.join(seriesDir, "_course-order.json"), parsed.data.newOrder);
    return Response.json({ ok: true });
  }

  // lesson
  const { series: seriesSlug, course: courseSlug, newOrder } = parsed.data as {
    type: "lesson"; series: string; course: string; newOrder: string[];
  };
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, courseSlug);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  writeOrderJson(path.join(courseDir, "_lesson-order.json"), newOrder);
  return Response.json({ ok: true });
}
