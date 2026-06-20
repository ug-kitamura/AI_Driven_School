import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
  loadMeta,
  saveMeta,
  saveMandala,
  buildCourseIdToSlugMap,
  loadContentsFolder,
} from "@/lib/contents-loader";

const schema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  target_audience: z.string().default(""),
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

  const { series: seriesSlug, course: courseSlug, target_audience, prerequisites, next_courses } = parsed.data;
  const contentsDir = getContentsDir(process.cwd());
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) {
    return Response.json({ error: `シリーズフォルダが見つかりません: ${seriesSlug}` }, { status: 404 });
  }
  const courseDir = findCourseDir(seriesDir, courseSlug);
  if (!courseDir) {
    return Response.json({ error: `コースフォルダが見つかりません: ${courseSlug}` }, { status: 404 });
  }

  // _meta.json に target_audience.ja を保存
  const meta = loadMeta(courseDir) ?? { title: { ja: courseSlug, en: null } };
  saveMeta(courseDir, {
    ...meta,
    target_audience: {
      ja: target_audience,
      en: meta.target_audience?.en ?? null,
    },
  });

  // コース ID → スラッグ変換（prerequisites/next_courses は ID で受け取りスラッグで保存）
  const allSeries = loadContentsFolder(process.cwd());
  const idToSlug = buildCourseIdToSlugMap(allSeries);

  const prereqSlugs = prerequisites.map((id) => idToSlug.get(id) ?? id);
  const nextSlugs = next_courses.map((id) => idToSlug.get(id) ?? id);

  // _mandala.json に保存
  saveMandala(courseDir, { prerequisites: prereqSlugs, next_courses: nextSlugs });

  return Response.json({ ok: true });
}
