/**
 * 既存 contents/ の .meta.json に安定 ID を付与し、
 * prerequisites/next_courses を cross_series_prev/cross_series_next に移行する。
 * 実行: npx tsx scripts/migrate-stable-ids.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateCourseId,
  generateSeriesId,
  legacyCourseId,
  readStoredId,
} from "../lib/content-ids.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const CONTENTS_DIR = path.join(ROOT, "contents");

function readJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeMetaJson(dir: string, data: Record<string, unknown>): void {
  fs.writeFileSync(path.join(dir, ".meta.json"), JSON.stringify(data, null, 2), "utf-8");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

type CourseEntry = {
  seriesName: string;
  courseName: string;
  courseDir: string;
  meta: Record<string, unknown>;
};

function main() {
  if (!fs.existsSync(CONTENTS_DIR)) {
    console.error(`エラー: ${CONTENTS_DIR} が見つかりません`);
    process.exit(1);
  }

  const usedIds = new Set<string>();
  const idRemap = new Map<string, string>();
  const courseEntries: CourseEntry[] = [];

  const seriesDirs = fs
    .readdirSync(CONTENTS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const seriesName of seriesDirs) {
    const seriesDir = path.join(CONTENTS_DIR, seriesName);
    const seriesMeta = readJson(seriesDir);
    const seriesId =
      readStoredId(seriesMeta) ?? generateSeriesId(seriesName, usedIds);
    idRemap.set(`series-${seriesName}`, seriesId);

    const courseDirs = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    for (const courseName of courseDirs) {
      const courseDir = path.join(seriesDir, courseName);
      const courseMeta = readJson(courseDir);
      const courseId =
        readStoredId(courseMeta) ?? generateCourseId(courseName, usedIds);
      idRemap.set(legacyCourseId(seriesName, courseName), courseId);
      courseEntries.push({ seriesName, courseName, courseDir, meta: courseMeta });
    }

    writeMetaJson(seriesDir, { ...seriesMeta, id: seriesId });
    console.log(`  [series] ${seriesName} → id: ${seriesId}`);
  }

  for (const entry of courseEntries) {
    const crossSeriesPrev = asStringArray(
      entry.meta.cross_series_prev ?? entry.meta.prerequisites,
    ).map((id) => idRemap.get(id) ?? id);
    const crossSeriesNext = asStringArray(
      entry.meta.cross_series_next ?? entry.meta.next_courses,
    ).map((id) => idRemap.get(id) ?? id);

    const {
      prerequisites: _p,
      next_courses: _n,
      target_audience: _ta,
      ...rest
    } = entry.meta as Record<string, unknown> & {
      prerequisites?: unknown;
      next_courses?: unknown;
      target_audience?: unknown;
    };

    const courseId =
      readStoredId(entry.meta) ??
      idRemap.get(legacyCourseId(entry.seriesName, entry.courseName))!;

    writeMetaJson(entry.courseDir, {
      ...rest,
      id: courseId,
      target:
        typeof entry.meta.target === "string"
          ? entry.meta.target
          : typeof entry.meta.target_audience === "string"
            ? entry.meta.target_audience
            : "",
      cross_series_prev: crossSeriesPrev,
      cross_series_next: crossSeriesNext,
    });
    console.log(
      `    [course] ${entry.seriesName}/${entry.courseName} → id: ${courseId}`,
    );
  }

  console.log(`\n移行完了: ${seriesDirs.length} シリーズ、${courseEntries.length} コース`);
}

main();
