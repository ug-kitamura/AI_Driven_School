import { z } from "zod";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  readMetaJson,
  writeMetaJson,
} from "@/lib/contents-loader";
import { courseStyleSchema } from "@/lib/schema";

const schema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  target: z.string().default(""),
  // 未設定は「キーを書かない」で表すため、空文字と欠落の両方を受ける
  style: courseStyleSchema.or(z.literal("")).optional(),
  cross_series_prev: z.array(z.string()).default([]),
  cross_series_next: z.array(z.string()).default([]),
  is_start: z.boolean().default(false),
  is_goal: z.boolean().default(false),
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

  const {
    series,
    course,
    target,
    style,
    cross_series_prev,
    cross_series_next,
    is_start,
    is_goal,
  } = parsed.data;
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
    // 未設定の表現は「キー無し」の1通りに保つため、既存の style も一度落とす
    const {
      target_audience: _legacy,
      style: _existingStyle,
      is_start: _existingStart,
      is_goal: _existingGoal,
      ...rest
    } = existing as Record<string, unknown> & {
      target_audience?: unknown;
      style?: unknown;
      is_start?: unknown;
      is_goal?: unknown;
    };
    writeMetaJson(courseDir, {
      ...rest,
      target,
      ...(style ? { style } : {}),
      cross_series_prev,
      cross_series_next,
      // 既定（false）はキーを書かない——style と同じく「未宣言＝キー無し」に保つ
      ...(is_start ? { is_start: true } : {}),
      ...(is_goal ? { is_goal: true } : {}),
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
