import fs from "node:fs";
import path from "node:path";
import {
  parseLessonDocument,
  normalizeLessonMeta,
  createLessonContentTemplate,
} from "@/lib/lesson-frontmatter";
import type { ContentMeta, Course, Lesson, MandalaData, Series } from "@/lib/schema";

export const CONTENTS_DIR_NAME = "contents";

export function getContentsDir(projectRoot: string): string {
  return path.join(projectRoot, CONTENTS_DIR_NAME);
}

export function contentsExists(projectRoot: string): boolean {
  return fs.existsSync(getContentsDir(projectRoot));
}

// ===== _meta.json 読み書き =====

/** `_meta.json` を読み込む。存在しない場合は null を返す */
export function loadMeta(dir: string): ContentMeta | null {
  const metaPath = path.join(dir, "_meta.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Partial<ContentMeta>;
    const titleJa =
      typeof raw.title?.ja === "string" ? raw.title.ja : path.basename(dir);
    return {
      title: {
        ja: titleJa,
        en: typeof raw.title?.en === "string" ? raw.title.en : null,
      },
      target_audience: {
        ja:
          typeof raw.target_audience?.ja === "string"
            ? raw.target_audience.ja
            : undefined,
        en:
          typeof raw.target_audience?.en === "string"
            ? raw.target_audience.en
            : null,
      },
    };
  } catch {
    return null;
  }
}

/** `_meta.json` を書き込む */
export function saveMeta(dir: string, meta: ContentMeta): void {
  fs.writeFileSync(
    path.join(dir, "_meta.json"),
    JSON.stringify(meta, null, 2),
    "utf-8",
  );
}

// ===== _mandala.json 読み書き =====

/** `_mandala.json` を読み込む。存在しない場合はデフォルト値を返す */
export function loadMandala(dir: string): MandalaData {
  const mandalaPath = path.join(dir, "_mandala.json");
  if (!fs.existsSync(mandalaPath)) return { prerequisites: [], next_courses: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(mandalaPath, "utf-8")) as Partial<MandalaData>;
    return {
      prerequisites: Array.isArray(raw.prerequisites) ? raw.prerequisites : [],
      next_courses: Array.isArray(raw.next_courses) ? raw.next_courses : [],
    };
  } catch {
    return { prerequisites: [], next_courses: [] };
  }
}

/** `_mandala.json` を書き込む */
export function saveMandala(dir: string, data: MandalaData): void {
  fs.writeFileSync(
    path.join(dir, "_mandala.json"),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

// ===== 順序 JSON 読み書き =====

function readOrderJson(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
    return Array.isArray(raw) ? (raw as string[]) : [];
  } catch {
    return [];
  }
}

function writeOrderJson(filePath: string, order: string[]): void {
  fs.writeFileSync(filePath, JSON.stringify(order, null, 2), "utf-8");
}

// ===== スラッグ直接一致による検索 =====

/**
 * スラッグに一致するシリーズフォルダの絶対パスを返す。
 * 見つからない場合は null を返す。
 */
export function findSeriesDir(contentsDir: string, slug: string): string | null {
  const candidate = path.join(contentsDir, slug);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return candidate;
  }
  return null;
}

/**
 * スラッグに一致するコースフォルダの絶対パスを返す。
 * 見つからない場合は null を返す。
 */
export function findCourseDir(seriesDir: string, slug: string): string | null {
  const candidate = path.join(seriesDir, slug);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return candidate;
  }
  return null;
}

/** series/course/lesson のスラッグからファイルシステム上の実パスを返す */
export function resolveLessonFilePath(
  projectRoot: string,
  seriesSlug: string,
  courseSlug: string,
  lessonSlug: string,
): string | null {
  const contentsDir = getContentsDir(projectRoot);
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) return null;
  const courseDir = findCourseDir(seriesDir, courseSlug);
  if (!courseDir) return null;
  const lessonPath = path.join(courseDir, `${lessonSlug}.md`);
  return fs.existsSync(lessonPath) ? lessonPath : null;
}

/** レッスンファイルのパスを返す。存在しなければ新規パスを返す */
export function resolveOrCreateLessonFilePath(
  projectRoot: string,
  seriesSlug: string,
  courseSlug: string,
  lessonSlug: string,
): string | null {
  const existing = resolveLessonFilePath(projectRoot, seriesSlug, courseSlug, lessonSlug);
  if (existing) return existing;

  const contentsDir = getContentsDir(projectRoot);
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) return null;
  const courseDir = findCourseDir(seriesDir, courseSlug);
  if (!courseDir) return null;
  return path.join(courseDir, `${lessonSlug}.md`);
}

// ===== contents フォルダ正規化 =====

/**
 * contents/ フォルダを正規化する（副作用あり）。
 * リネームは一切行わず、欠けている JSON ファイルを生成するだけ。
 */
export function normalizeContentsFolder(projectRoot: string): void {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return;

  const seriesDirs = fs
    .readdirSync(contentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();

  // _series-order.json が欠けていれば生成
  const seriesOrderPath = path.join(contentsDir, "_series-order.json");
  if (!fs.existsSync(seriesOrderPath)) {
    writeOrderJson(seriesOrderPath, seriesDirs);
  } else {
    // 順序 JSON に含まれないフォルダを末尾に追記
    const existing = readOrderJson(seriesOrderPath);
    const missing = seriesDirs.filter((d) => !existing.includes(d));
    if (missing.length > 0) {
      writeOrderJson(seriesOrderPath, [...existing, ...missing]);
    }
  }

  for (const seriesDirName of seriesDirs) {
    const seriesDir = path.join(contentsDir, seriesDirName);

    // _meta.json が欠けていれば生成
    if (!fs.existsSync(path.join(seriesDir, "_meta.json"))) {
      try {
        saveMeta(seriesDir, {
          title: { ja: seriesDirName, en: null },
          target_audience: { ja: "", en: null },
        });
      } catch { /* ignore */ }
    }

    const courseDirs = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort();

    // _course-order.json が欠けていれば生成
    const courseOrderPath = path.join(seriesDir, "_course-order.json");
    if (!fs.existsSync(courseOrderPath)) {
      writeOrderJson(courseOrderPath, courseDirs);
    } else {
      const existing = readOrderJson(courseOrderPath);
      const missing = courseDirs.filter((d) => !existing.includes(d));
      if (missing.length > 0) {
        writeOrderJson(courseOrderPath, [...existing, ...missing]);
      }
    }

    for (const courseDirName of courseDirs) {
      const courseDir = path.join(seriesDir, courseDirName);

      // _meta.json が欠けていれば生成
      if (!fs.existsSync(path.join(courseDir, "_meta.json"))) {
        try {
          saveMeta(courseDir, {
            title: { ja: courseDirName, en: null },
            target_audience: { ja: "", en: null },
          });
        } catch { /* ignore */ }
      }

      // _mandala.json が欠けていれば生成
      if (!fs.existsSync(path.join(courseDir, "_mandala.json"))) {
        try {
          saveMandala(courseDir, { prerequisites: [], next_courses: [] });
        } catch { /* ignore */ }
      }

      // レッスン（拡張子 .md、.en.md 以外）
      const lessonFiles = fs
        .readdirSync(courseDir)
        .filter((f) => f.endsWith(".md") && !f.endsWith(".en.md"))
        .map((f) => f.replace(/\.md$/, ""))
        .sort();

      const lessonOrderPath = path.join(courseDir, "_lesson-order.json");
      if (!fs.existsSync(lessonOrderPath)) {
        writeOrderJson(lessonOrderPath, lessonFiles);
      } else {
        const existing = readOrderJson(lessonOrderPath);
        const missing = lessonFiles.filter((l) => !existing.includes(l));
        if (missing.length > 0) {
          writeOrderJson(lessonOrderPath, [...existing, ...missing]);
        }
      }
    }
  }
}

// ===== メインローダー =====

/** `contents/` フォルダを走査して `Series[]` を構築する */
export function loadContentsFolder(projectRoot: string): Series[] {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return [];

  // _series-order.json を読んで順序を決定
  const seriesOrder = readOrderJson(path.join(contentsDir, "_series-order.json"));
  const allSeriesDirs = new Set(
    fs
      .readdirSync(contentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
      .map((e) => e.name),
  );

  // 順序 JSON に含まれているが実際に存在するもの + JSON に含まれていないものを末尾に
  const orderedSeries = [
    ...seriesOrder.filter((s) => allSeriesDirs.has(s)),
    ...[...allSeriesDirs].filter((s) => !seriesOrder.includes(s)).sort(),
  ];

  // コース ID → コーススラッグ のマップ（後で prerequisites 解決に使う）
  // courseId = `course-${seriesSlug}-${courseSlug}`
  const slugToCourseId = new Map<string, string[]>(); // courseSlug → [courseId, ...]

  // 第 1 パス: 全 Series/Course を読み込み（prerequisites は slug のまま）
  const rawSeries: Array<{ series: Series; slugRefs: { courseId: string; prereqs: string[]; nexts: string[] }[] }> = [];

  for (const seriesSlug of orderedSeries) {
    const seriesDir = path.join(contentsDir, seriesSlug);
    if (!fs.existsSync(seriesDir)) continue;

    const seriesMeta = loadMeta(seriesDir);
    const seriesName = seriesMeta?.title.ja ?? seriesSlug;
    const seriesTitleEn = seriesMeta?.title.en ?? null;
    const seriesId = `series-${seriesSlug}`;

    const courseOrder = readOrderJson(path.join(seriesDir, "_course-order.json"));
    const allCourseDirs = new Set(
      fs
        .readdirSync(seriesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
        .map((e) => e.name),
    );

    const orderedCourses = [
      ...courseOrder.filter((c) => allCourseDirs.has(c)),
      ...[...allCourseDirs].filter((c) => !courseOrder.includes(c)).sort(),
    ];

    const courses: Course[] = [];
    const slugRefs: { courseId: string; prereqs: string[]; nexts: string[] }[] = [];

    for (const courseSlug of orderedCourses) {
      const courseDir = path.join(seriesDir, courseSlug);
      if (!fs.existsSync(courseDir)) continue;

      const courseMeta = loadMeta(courseDir);
      const courseName = courseMeta?.title.ja ?? courseSlug;
      const courseTitleEn = courseMeta?.title.en ?? null;
      const targetAudienceJa = courseMeta?.target_audience?.ja ?? "";
      const targetAudienceEn = courseMeta?.target_audience?.en ?? null;
      const courseId = `course-${seriesSlug}-${courseSlug}`;

      const mandala = loadMandala(courseDir);

      // スラッグ → courseId マップ構築
      if (!slugToCourseId.has(courseSlug)) {
        slugToCourseId.set(courseSlug, []);
      }
      slugToCourseId.get(courseSlug)!.push(courseId);

      slugRefs.push({
        courseId,
        prereqs: mandala.prerequisites,
        nexts: mandala.next_courses,
      });

      // レッスン読み込み
      const lessonOrder = readOrderJson(path.join(courseDir, "_lesson-order.json"));
      const allLessonFiles = new Set(
        fs
          .readdirSync(courseDir)
          .filter((f) => f.endsWith(".md") && !f.endsWith(".en.md"))
          .map((f) => f.replace(/\.md$/, "")),
      );

      const orderedLessons = [
        ...lessonOrder.filter((l) => allLessonFiles.has(l)),
        ...[...allLessonFiles].filter((l) => !lessonOrder.includes(l)).sort(),
      ];

      const lessons: Lesson[] = [];

      for (const lessonSlug of orderedLessons) {
        const lessonFilePath = path.join(courseDir, `${lessonSlug}.md`);
        if (!fs.existsSync(lessonFilePath)) continue;
        const lessonId = `lesson-${seriesSlug}-${courseSlug}-${lessonSlug}`;

        let content = fs.readFileSync(lessonFilePath, "utf-8");

        const { meta } = parseLessonDocument(content);
        const metaWithoutLesson = { ...meta };
        delete metaWithoutLesson.lesson;
        const normalized = normalizeLessonMeta(
          metaWithoutLesson,
          { seriesName: seriesSlug, courseName: courseSlug },
          {
            lesson: lessonSlug,
            series: seriesSlug,
            course: courseSlug,
            status: "open",
            description: "",
            tags: [],
            estimated_minutes: 0,
            author: "",
          },
        );

        if (!content.trim()) {
          content = createLessonContentTemplate(normalized);
          fs.writeFileSync(lessonFilePath, content, "utf-8");
        }

        lessons.push({
          id: lessonId,
          slug: lessonSlug,
          ...normalized,
          content,
        });
      }

      courses.push({
        id: courseId,
        slug: courseSlug,
        name: courseName,
        titleEn: courseTitleEn,
        target_audience: targetAudienceJa,
        targetAudienceEn: targetAudienceEn,
        prerequisites: [],
        next_courses: [],
        lessons,
      });
    }

    rawSeries.push({
      series: {
        id: seriesId,
        slug: seriesSlug,
        name: seriesName,
        titleEn: seriesTitleEn,
        courses,
      },
      slugRefs,
    });
  }

  // 第 2 パス: prerequisites/next_courses のスラッグ → courseId 解決
  const courseIdMap = new Map<string, string>(); // courseId → courseId (identity)
  for (const { series } of rawSeries) {
    for (const course of series.courses) {
      courseIdMap.set(course.id, course.id);
    }
  }

  function resolveSlugToId(courseSlug: string, selfCourseId: string): string {
    const ids = slugToCourseId.get(courseSlug);
    if (!ids || ids.length === 0) return "";
    // 自分自身を除いた最初のものを返す（クロスシリーズ参照）
    const crossSeries = ids.filter((id) => id !== selfCourseId);
    return crossSeries[0] ?? ids[0];
  }

  const result: Series[] = rawSeries.map(({ series, slugRefs }) => ({
    ...series,
    courses: series.courses.map((course) => {
      const ref = slugRefs.find((r) => r.courseId === course.id);
      if (!ref) return course;
      return {
        ...course,
        prerequisites: ref.prereqs
          .map((slug) => resolveSlugToId(slug, course.id))
          .filter(Boolean),
        next_courses: ref.nexts
          .map((slug) => resolveSlugToId(slug, course.id))
          .filter(Boolean),
      };
    }),
  }));

  return result;
}

// ===== コース ID → スラッグ 変換ヘルパー =====

/** コース ID からコーススラッグを抽出する（`course-{seriesSlug}-{courseSlug}` 形式） */
export function courseIdToSlugs(courseId: string): { seriesSlug: string; courseSlug: string } | null {
  const match = courseId.match(/^course-([^-]+(?:-[^-]+)*?)-([^-]+)$/);
  if (!match) {
    // より確実な方法: "course-" を除去して残りを二分割
    const withoutPrefix = courseId.replace(/^course-/, "");
    // 最後の "-" で分割
    const lastDash = withoutPrefix.lastIndexOf("-");
    if (lastDash === -1) return null;
    return {
      seriesSlug: withoutPrefix.slice(0, lastDash),
      courseSlug: withoutPrefix.slice(lastDash + 1),
    };
  }
  return { seriesSlug: match[1], courseSlug: match[2] };
}

/**
 * Series[] からコース ID をスラッグに逆引きするマップを構築する。
 * `_mandala.json` への保存時に使用する。
 */
export function buildCourseIdToSlugMap(series: Series[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of series) {
    for (const c of s.courses) {
      if (c.slug) map.set(c.id, c.slug);
    }
  }
  return map;
}

// ===== mtime / fingerprint =====

/** contents/ 以下の全ファイル・フォルダの最新 mtime（ミリ秒）を返す */
export function getContentsLatestMtime(projectRoot: string): number {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return 0;
  let latest = fs.statSync(contentsDir).mtimeMs;
  function scan(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      try {
        const mtime = fs.statSync(p).mtimeMs;
        if (mtime > latest) latest = mtime;
        if (e.isDirectory()) scan(p);
      } catch {
        /* ignore */
      }
    }
  }
  scan(contentsDir);
  return latest;
}

/**
 * contents/ ツリーのスナップショット指紋。
 * パス一覧で変化を検知する。
 */
export function getContentsFingerprint(projectRoot: string): string {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return "";
  const lines: string[] = [];

  function walk(dir: string, rel: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      const childPath = path.join(dir, e.name);
      try {
        const stat = fs.statSync(childPath);
        lines.push(`${childRel}\t${stat.size}\t${stat.mtimeMs}`);
        if (e.isDirectory()) walk(childPath, childRel);
      } catch {
        /* ignore */
      }
    }
  }

  walk(contentsDir, "");
  return lines.join("\n");
}
