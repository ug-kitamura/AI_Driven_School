/**
 * 翻訳鮮度の走査（dx-training-translate スキル同梱・読み取り専用）。
 *
 * 判定とハッシュは Studio の正本実装（studio/lib/translation/freshness.ts）を
 * import する——スキル側に第3の実装を作らない（training-translate-skill spec）。
 *
 * 実行:
 *   node --experimental-strip-types .claude/skills/dx-training-translate/references/scan-freshness.mts [シリーズ] [コース] [レッスン]
 *   （dx-training-studio/ ディレクトリを起点にパス解決するので cwd はどこでもよい）
 *
 * 出力: ユニットごとの状態と、翻訳時に書くべきハッシュ値（JSON）。
 * 状態: untranslated（未翻訳）/ stale（翻訳が古い）/ fresh（最新）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bodyFreshness,
  changelogFreshness,
  computeBodySourceHash,
  computeMetaSourceHash,
  metaFreshness,
  type MetaSourceFields,
} from "../../../../studio/lib/translation/freshness.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);
const contentsDir = path.join(projectRoot, "contents");

const [argSeries, argCourse, argLesson] = process.argv.slice(2);

function readMeta(dir: string): Record<string, unknown> {
  const p = path.join(dir, ".meta.json");
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, unknown>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."),
    )
    .map((e) => e.name)
    .sort();
}

type UnitReport = {
  unit: string;
  level: "root" | "series" | "course" | "lesson";
  meta: string;
  /** 翻訳時に .meta.json の en_source_hash へ書く値 */
  metaHashToWrite: string;
  body?: string;
  /** 翻訳時に contents.en.md の1行目コメントへ書く値 */
  bodyHashToWrite?: string;
  status?: string;
};

const reports: UnitReport[] = [];

function metaReport(
  unit: string,
  level: UnitReport["level"],
  fields: MetaSourceFields,
  meta: Record<string, unknown>,
  enKeys: string[],
): UnitReport {
  const hasEn = enKeys.some((k) => str(meta[k]).length > 0);
  const stored = str(meta.en_source_hash) || null;
  return {
    unit,
    level,
    meta: metaFreshness(fields, hasEn, stored),
    metaHashToWrite: computeMetaSourceHash(fields),
  };
}

// 全体
if (!argSeries) {
  const rootMeta = readMeta(contentsDir);
  reports.push(
    metaReport(
      "(全体)",
      "root",
      {
        level: "root",
        name: str(rootMeta.name),
        description: str(rootMeta.description),
      },
      rootMeta,
      ["name_en", "description_en"],
    ),
  );
}

for (const seriesName of listDirs(contentsDir)) {
  if (argSeries && seriesName !== argSeries) continue;
  const seriesDir = path.join(contentsDir, seriesName);
  const seriesMeta = readMeta(seriesDir);
  if (!argCourse) {
    reports.push(
      metaReport(
        seriesName,
        "series",
        {
          level: "series",
          name: seriesName,
          catch: str(seriesMeta.catch),
          description: str(seriesMeta.description),
        },
        seriesMeta,
        ["name_en", "catch_en", "description_en"],
      ),
    );
  }

  for (const courseName of listDirs(seriesDir)) {
    if (argCourse && courseName !== argCourse) continue;
    const courseDir = path.join(seriesDir, courseName);
    const courseMeta = readMeta(courseDir);
    if (!argLesson) {
      reports.push(
        metaReport(
          `${seriesName}/${courseName}`,
          "course",
          {
            level: "course",
            name: courseName,
            catch: str(courseMeta.catch),
            description: str(courseMeta.description),
            target: str(courseMeta.target),
          },
          courseMeta,
          ["name_en", "catch_en", "description_en", "target_en"],
        ),
      );
    }

    for (const lessonName of listDirs(courseDir)) {
      if (argLesson && lessonName !== argLesson) continue;
      const lessonDir = path.join(courseDir, lessonName);
      const jaPath = path.join(lessonDir, "contents.md");
      if (!fs.existsSync(jaPath)) continue;
      const lessonMeta = readMeta(lessonDir);
      const jaBody = fs.readFileSync(jaPath, "utf-8");
      const enPath = path.join(lessonDir, "contents.en.md");
      const enRaw = fs.existsSync(enPath)
        ? fs.readFileSync(enPath, "utf-8")
        : null;
      const report = metaReport(
        `${seriesName}/${courseName}/${lessonName}`,
        "lesson",
        {
          level: "lesson",
          name: lessonName,
          description: str(lessonMeta.description),
        },
        lessonMeta,
        ["name_en", "description_en"],
      );
      report.body = bodyFreshness(jaBody, enRaw);
      report.bodyHashToWrite = computeBodySourceHash(jaBody);
      report.status = str(lessonMeta.status) || "open";
      reports.push(report);
    }
  }
}

// changelog（どの範囲でも対象。日付比較なのでハッシュは無い）
const changelogJaPath = path.join(contentsDir, "changelog.md");
const changelog = fs.existsSync(changelogJaPath)
  ? changelogFreshness(
      fs.readFileSync(changelogJaPath, "utf-8"),
      fs.existsSync(path.join(contentsDir, "changelog.en.md"))
        ? fs.readFileSync(path.join(contentsDir, "changelog.en.md"), "utf-8")
        : null,
    )
  : null;

const states = reports.flatMap((r) => [r.meta, ...(r.body ? [r.body] : [])]);
const count = (s: string) => states.filter((x) => x === s).length;
console.log(
  JSON.stringify(
    {
      summary: {
        untranslated: count("untranslated"),
        stale: count("stale"),
        fresh: count("fresh"),
      },
      changelog,
      units: reports,
    },
    null,
    2,
  ),
);
