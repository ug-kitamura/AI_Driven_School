import fs from "node:fs";
import path from "node:path";
import { sanitizeFilename, stripPrefix, withPrefix } from "@/lib/content-filename";
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

/**
 * シリーズ表示名に一致するフォルダの絶対パスを返す（数値プレフィックスを無視）。
 * 見つからない場合は null を返す。
 */
export function findSeriesDir(contentsDir: string, seriesName: string): string | null {
  if (!fs.existsSync(contentsDir)) return null;
  const entries = fs
    .readdirSync(contentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && stripPrefix(e.name) === seriesName);
  return entries.length > 0 ? path.join(contentsDir, entries[0].name) : null;
}

/**
 * コース表示名に一致するフォルダの絶対パスを返す（数値プレフィックスを無視）。
 * 見つからない場合は null を返す。
 */
export function findCourseDir(seriesDir: string, courseName: string): string | null {
  if (!fs.existsSync(seriesDir)) return null;
  const entries = fs
    .readdirSync(seriesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && stripPrefix(e.name) === courseName);
  return entries.length > 0 ? path.join(seriesDir, entries[0].name) : null;
}

/** series/course/lesson の表示名からファイルシステム上の実パスを検索して返す */
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
  const lessonFiles = fs
    .readdirSync(courseDir)
    .filter((f) => f.endsWith(".md") && stripPrefix(f) === lessonName)
    .sort(numericPrefixSort);
  if (lessonFiles.length === 0) return null;
  return path.join(courseDir, lessonFiles[lessonFiles.length - 1]);
}

/** レッスンファイルのパスを返す。存在しなければ採番して新規パスを返す */
export function resolveOrCreateLessonFilePath(
  projectRoot: string,
  seriesName: string,
  courseName: string,
  lessonName: string,
): string | null {
  const existing = resolveLessonFilePath(
    projectRoot,
    seriesName,
    courseName,
    lessonName,
  );
  if (existing) return existing;

  const contentsDir = getContentsDir(projectRoot);
  const seriesDir = findSeriesDir(contentsDir, seriesName);
  if (!seriesDir) return null;
  const courseDir = findCourseDir(seriesDir, courseName);
  if (!courseDir) return null;

  const existingLessons = fs
    .readdirSync(courseDir)
    .filter((f) => f.endsWith(".md")).length;
  const lessonFileName = `${withPrefix(existingLessons, lessonName)}.md`;
  return path.join(courseDir, lessonFileName);
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
 * contents/ フォルダを正規化する（副作用あり）。
 * - 数値プレフィックスがないシリーズ/コース/レッスンには自動採番する
 * - コースフォルダに .meta.json がない場合は空ファイルを生成する
 * ロード前に呼ぶことで「直接追加されたフォルダ/ファイル」を即座にアプリに反映できる。
 */
export function normalizeContentsFolder(projectRoot: string): void {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return;

  const seriesDirs = fs
    .readdirSync(contentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(numericPrefixSort);

  // シリーズ採番
  for (let si = 0; si < seriesDirs.length; si++) {
    const oldName = seriesDirs[si];
    const displayName = stripPrefix(oldName);
    const expectedName = withPrefix(si, displayName);
    if (oldName !== expectedName) {
      try {
        fs.renameSync(
          path.join(contentsDir, oldName),
          path.join(contentsDir, expectedName),
        );
        seriesDirs[si] = expectedName;
      } catch {
        /* ignore */
      }
    }

    const seriesDir = path.join(contentsDir, seriesDirs[si]);
    const courseDirs = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort(numericPrefixSort);

    // コース採番
    for (let ci = 0; ci < courseDirs.length; ci++) {
      const oldCourseName = courseDirs[ci];
      const courseDisplayName = stripPrefix(oldCourseName);
      const expectedCourseName = withPrefix(ci, courseDisplayName);
      if (oldCourseName !== expectedCourseName) {
        try {
          fs.renameSync(
            path.join(seriesDir, oldCourseName),
            path.join(seriesDir, expectedCourseName),
          );
          courseDirs[ci] = expectedCourseName;
        } catch {
          /* ignore */
        }
      }

      const courseDir = path.join(seriesDir, courseDirs[ci]);

      // .meta.json が存在しない場合は作成
      const metaPath = path.join(courseDir, ".meta.json");
      if (!fs.existsSync(metaPath)) {
        try {
          fs.writeFileSync(
            metaPath,
            JSON.stringify({ target_audience: "", prerequisites: [], next_courses: [] }, null, 2),
            "utf-8",
          );
        } catch {
          /* ignore */
        }
      }

      // レッスン採番
      const lessonFiles = fs
        .readdirSync(courseDir)
        .filter((f) => f.endsWith(".md"))
        .sort(numericPrefixSort);

      for (let li = 0; li < lessonFiles.length; li++) {
        const oldLessonName = lessonFiles[li];
        const lessonDisplayName = stripPrefix(oldLessonName);
        const expectedLessonName = `${withPrefix(li, lessonDisplayName)}.md`;
        if (oldLessonName !== expectedLessonName) {
          try {
            fs.renameSync(
              path.join(courseDir, oldLessonName),
              path.join(courseDir, expectedLessonName),
            );
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
}

/** `contents/` フォルダを走査して `Series[]` を構築する */
export function loadContentsFolder(projectRoot: string): Series[] {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return [];

  const seriesDirs = fs
    .readdirSync(contentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(numericPrefixSort);

  const result: Series[] = [];

  for (const seriesDirName of seriesDirs) {
    const seriesDir = path.join(contentsDir, seriesDirName);
    const seriesName = stripPrefix(seriesDirName);
    const seriesId = `series-${seriesName}`;

    const courseDirs = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort(numericPrefixSort);

    const courses: Course[] = [];

    for (const courseDirName of courseDirs) {
      const courseDir = path.join(seriesDir, courseDirName);
      const courseName = stripPrefix(courseDirName);
      const courseId = `course-${seriesName}-${courseName}`;
      const courseMeta = loadCourseMeta(courseDir);

      const lessonFiles = fs
        .readdirSync(courseDir)
        .filter((f) => f.endsWith(".md"))
        .sort(numericPrefixSort);

      const lessons: Lesson[] = [];

      for (const lessonFileName of lessonFiles) {
        const lessonFilePath = path.join(courseDir, lessonFileName);
        const lessonName = stripPrefix(lessonFileName);
        const lessonId = `lesson-${seriesName}-${courseName}-${lessonName}`;
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
          id: lessonId,
          ...normalized,
          content,
        });
      }

      courses.push({
        id: courseId,
        name: courseName,
        target_audience: courseMeta.target_audience,
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
  target_audience: string;
  prerequisites: string[];
  next_courses: string[];
} {
  // .meta.json を優先、旧形式 _course.json もフォールバックとして読む
  const candidates = [".meta.json", "_course.json"];
  for (const name of candidates) {
    const metaFile = path.join(courseDir, name);
    if (!fs.existsSync(metaFile)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(metaFile, "utf-8")) as {
        target_audience?: string;
        prerequisites?: string[];
        next_courses?: string[];
      };
      return {
        target_audience: raw.target_audience ?? "",
        prerequisites: raw.prerequisites ?? [],
        next_courses: raw.next_courses ?? [],
      };
    } catch {
      /* try next */
    }
  }
  return { target_audience: "", prerequisites: [], next_courses: [] };
}

function numericPrefixSort(a: string, b: string): number {
  const na = parseInt(a.match(/^(\d+)/)?.[1] ?? "0", 10);
  const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? "0", 10);
  if (na !== nb) return na - nb;
  return a.localeCompare(b);
}
