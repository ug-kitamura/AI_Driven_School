import fs from "node:fs";
import path from "node:path";
import { sanitizeFilename } from "@/lib/content-filename";
import {
  parseLessonDocument,
  normalizeLessonMeta,
  createLessonContentTemplate,
} from "@/lib/lesson-frontmatter";
import type { Course, Lesson, Series } from "@/lib/schema";

export const CONTENTS_DIR_NAME = "contents";

export function getContentsDir(projectRoot: string): string {
  return path.join(projectRoot, CONTENTS_DIR_NAME);
}

export function contentsExists(projectRoot: string): boolean {
  return fs.existsSync(getContentsDir(projectRoot));
}

/** `.meta.json` を読み込んで返す。存在しない・パース失敗時は空オブジェクトを返す */
export function readMetaJson(dir: string): Record<string, unknown> {
  const metaPath = path.join(dir, ".meta.json");
  if (!fs.existsSync(metaPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** `.meta.json` に data を書き込む */
export function writeMetaJson(dir: string, data: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(dir, ".meta.json"),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

/**
 * シリーズ表示名に一致するフォルダの絶対パスを返す。
 * 見つからない場合は null を返す。
 */
export function findSeriesDir(contentsDir: string, seriesName: string): string | null {
  if (!fs.existsSync(contentsDir)) return null;
  const dir = path.join(contentsDir, seriesName);
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : null;
}

/**
 * コース表示名に一致するフォルダの絶対パスを返す。
 * 見つからない場合は null を返す。
 */
export function findCourseDir(seriesDir: string, courseName: string): string | null {
  if (!fs.existsSync(seriesDir)) return null;
  const dir = path.join(seriesDir, courseName);
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? dir : null;
}

/** series/course/lesson の表示名からファイルシステム上の実パスを返す */
export function resolveLessonFilePath(
  projectRoot: string,
  seriesName: string,
  courseName: string,
  lessonName: string,
): string | null {
  const contentsDir = getContentsDir(projectRoot);
  const seriesDir = findSeriesDir(contentsDir, seriesName);
  if (!seriesDir) return null;
  const courseDir = findCourseDir(seriesDir, courseName);
  if (!courseDir) return null;
  const lessonFile = path.join(courseDir, `${lessonName}.md`);
  return fs.existsSync(lessonFile) ? lessonFile : null;
}

/** レッスンファイルのパスを返す。存在しなければ新規パスを返す */
export function resolveOrCreateLessonFilePath(
  projectRoot: string,
  seriesName: string,
  courseName: string,
  lessonName: string,
): string | null {
  const existing = resolveLessonFilePath(projectRoot, seriesName, courseName, lessonName);
  if (existing) return existing;

  const contentsDir = getContentsDir(projectRoot);
  const seriesDir = findSeriesDir(contentsDir, seriesName);
  if (!seriesDir) return null;
  const courseDir = findCourseDir(seriesDir, courseName);
  if (!courseDir) return null;

  return path.join(courseDir, `${sanitizeFilename(lessonName)}.md`);
}

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
 * リネームは mtime が変わらないことがあるため、パス一覧で変化を検知する。
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

/**
 * `.meta.json` の order 配列と FS の実態を突き合わせて補完する（副作用: JSON 書き換えのみ、FS は変更しない）。
 * - order に存在するが FS にないエントリを除去する
 * - FS にあるが order にないエントリを末尾に追加する
 * ロード前に呼ぶことで「直接追加・削除されたフォルダ/ファイル」を自動的に反映できる。
 */
export function reconcileOrderFiles(projectRoot: string): void {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return;

  const actualSeries = new Set(
    fs.readdirSync(contentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  );
  const contentsMeta = readMetaJson(contentsDir);
  const seriesOrder = Array.isArray(contentsMeta.order) ? (contentsMeta.order as string[]) : [];
  const reconciledSeries = reconcileOrder(seriesOrder, actualSeries);
  const effectiveSeries = reconciledSeries ?? seriesOrder;
  if (reconciledSeries !== null) {
    writeMetaJson(contentsDir, { ...contentsMeta, order: effectiveSeries });
  }

  for (const seriesName of effectiveSeries) {
    const seriesDir = path.join(contentsDir, seriesName);
    if (!fs.existsSync(seriesDir)) continue;

    const actualCourses = new Set(
      fs.readdirSync(seriesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name),
    );
    const seriesMeta = readMetaJson(seriesDir);
    const courseOrder = Array.isArray(seriesMeta.order) ? (seriesMeta.order as string[]) : [];
    const reconciledCourses = reconcileOrder(courseOrder, actualCourses);
    const effectiveCourses = reconciledCourses ?? courseOrder;
    if (reconciledCourses !== null) {
      writeMetaJson(seriesDir, { ...seriesMeta, order: effectiveCourses });
    }

    for (const courseName of effectiveCourses) {
      const courseDir = path.join(seriesDir, courseName);
      if (!fs.existsSync(courseDir)) continue;

      const actualLessons = new Set(
        fs.readdirSync(courseDir)
          .filter((f) => f.endsWith(".md"))
          .map((f) => f.slice(0, -3)),
      );
      const courseMeta = readMetaJson(courseDir);
      const lessonOrder = Array.isArray(courseMeta.order) ? (courseMeta.order as string[]) : [];
      const reconciledLessons = reconcileOrder(lessonOrder, actualLessons);
      if (reconciledLessons !== null) {
        writeMetaJson(courseDir, { ...courseMeta, order: reconciledLessons });
      }

      // .meta.json が存在しない場合は空ファイルを生成
      const metaPath = path.join(courseDir, ".meta.json");
      if (!fs.existsSync(metaPath)) {
        writeMetaJson(courseDir, {
          order: [...actualLessons].sort(),
          target: "",
          prerequisites: [],
          next_courses: [],
        });
      }
    }
  }
}

/** `contents/` フォルダを走査して `Series[]` を構築する */
export function loadContentsFolder(projectRoot: string): Series[] {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return [];

  const contentsMeta = readMetaJson(contentsDir);
  const seriesOrder = Array.isArray(contentsMeta.order) ? (contentsMeta.order as string[]) : [];

  const actualSeriesDirs = fs
    .readdirSync(contentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const effectiveSeries =
    seriesOrder.length > 0
      ? seriesOrder.filter((name) => fs.existsSync(path.join(contentsDir, name)))
      : [...actualSeriesDirs].sort();

  const result: Series[] = [];

  for (const seriesDirName of effectiveSeries) {
    const seriesDir = path.join(contentsDir, seriesDirName);
    const seriesName = seriesDirName;
    const seriesId = `series-${seriesName}`;

    const seriesMeta = readMetaJson(seriesDir);
    const courseOrder = Array.isArray(seriesMeta.order) ? (seriesMeta.order as string[]) : [];

    const actualCourseDirs = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    const effectiveCourses =
      courseOrder.length > 0
        ? courseOrder.filter((name) => fs.existsSync(path.join(seriesDir, name)))
        : [...actualCourseDirs].sort();

    const courses: Course[] = [];

    for (const courseDirName of effectiveCourses) {
      const courseDir = path.join(seriesDir, courseDirName);
      const courseName = courseDirName;
      const courseId = `course-${seriesName}-${courseName}`;
      const courseMeta = loadCourseMeta(courseDir);

      const actualLessonFiles = fs
        .readdirSync(courseDir)
        .filter((f) => f.endsWith(".md"));
      const actualLessonNames = new Set(actualLessonFiles.map((f) => f.slice(0, -3)));

      const effectiveLessons =
        courseMeta.order.length > 0
          ? courseMeta.order.filter((name) => actualLessonNames.has(name))
          : [...actualLessonNames].sort();

      const lessons: Lesson[] = [];

      for (const lessonName of effectiveLessons) {
        const lessonFilePath = path.join(courseDir, `${lessonName}.md`);
        let content = fs.readFileSync(lessonFilePath, "utf-8");

        const { meta } = parseLessonDocument(content);
        const metaWithoutLesson = { ...meta };
        delete metaWithoutLesson.lesson;
        const normalized = normalizeLessonMeta(
          metaWithoutLesson,
          { seriesName, courseName },
          {
            lesson: lessonName,
            series: seriesName,
            course: courseName,
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
          id: `lesson-${seriesName}-${courseName}-${lessonName}`,
          ...normalized,
          content,
        });
      }

      courses.push({
        id: courseId,
        name: courseName,
        target: courseMeta.target,
        prerequisites: courseMeta.prerequisites,
        next_courses: courseMeta.next_courses,
        lessons,
      });
    }

    result.push({ id: seriesId, name: seriesName, courses });
  }

  return result;
}

function loadCourseMeta(courseDir: string): {
  target: string;
  prerequisites: string[];
  next_courses: string[];
  order: string[];
} {
  const meta = readMetaJson(courseDir);

  // _course.json フォールバック（旧形式）
  if (Object.keys(meta).length === 0) {
    const legacy = path.join(courseDir, "_course.json");
    if (fs.existsSync(legacy)) {
      try {
        const raw = JSON.parse(fs.readFileSync(legacy, "utf-8")) as Record<string, unknown>;
        return {
          target: typeof raw.target === "string" ? raw.target : (typeof raw.target_audience === "string" ? raw.target_audience : ""),
          prerequisites: Array.isArray(raw.prerequisites) ? (raw.prerequisites as string[]) : [],
          next_courses: Array.isArray(raw.next_courses) ? (raw.next_courses as string[]) : [],
          order: [],
        };
      } catch {
        /* ignore */
      }
    }
  }

  return {
    target: typeof meta.target === "string" ? meta.target : (typeof meta.target_audience === "string" ? meta.target_audience : ""),
    prerequisites: Array.isArray(meta.prerequisites) ? (meta.prerequisites as string[]) : [],
    next_courses: Array.isArray(meta.next_courses) ? (meta.next_courses as string[]) : [],
    order: Array.isArray(meta.order) ? (meta.order as string[]) : [],
  };
}

/**
 * order 配列と actual Set を突き合わせる。
 * 変更がなければ null、変更があれば新しい配列を返す。
 */
function reconcileOrder(ordered: string[], actual: Set<string>): string[] | null {
  const filtered = ordered.filter((name) => actual.has(name));
  const inOrder = new Set(filtered);
  const added = [...actual].filter((name) => !inOrder.has(name)).sort();
  if (added.length === 0 && filtered.length === ordered.length) return null;
  return [...filtered, ...added];
}
