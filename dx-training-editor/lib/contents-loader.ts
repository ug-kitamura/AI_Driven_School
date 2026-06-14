import fs from "node:fs";
import path from "node:path";
import { stripPrefix } from "@/lib/content-filename";
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

/** `contents/` フォルダが存在するかどうか */
export function contentsExists(projectRoot: string): boolean {
  return fs.existsSync(getContentsDir(projectRoot));
}

/** series/course/lesson の表示名からファイルシステム上の実パスを検索して返す */
export function resolveLessonFilePath(
  projectRoot: string,
  seriesName: string,
  courseName: string,
  lessonName: string,
): string | null {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return null;

  const seriesSanitized = seriesName.replace(/[/\\:*?"<>|]/g, "_").trim();
  const seriesDir = path.join(contentsDir, seriesSanitized);
  if (!fs.existsSync(seriesDir)) return null;

  const courseDirs = fs
    .readdirSync(seriesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && stripPrefix(e.name) === courseName);
  if (courseDirs.length === 0) return null;
  const courseDir = path.join(seriesDir, courseDirs[0].name);

  const lessonFiles = fs
    .readdirSync(courseDir)
    .filter(
      (f) => f.endsWith(".md") && stripPrefix(f) === lessonName,
    );
  if (lessonFiles.length === 0) return null;
  return path.join(courseDir, lessonFiles[0]);
}

/** `contents/` フォルダを走査して `Series[]` を構築する */
export function loadContentsFolder(projectRoot: string): Series[] {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return [];

  const seriesOrder = loadSeriesOrder(contentsDir);
  const seriesDirs = fs
    .readdirSync(contentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const seriesDirsSorted = sortByOrder(seriesDirs, seriesOrder);

  const result: Series[] = [];

  for (const seriesDirName of seriesDirsSorted) {
    const seriesDir = path.join(contentsDir, seriesDirName);
    const seriesName = seriesDirName;
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
        const content = fs.readFileSync(lessonFilePath, "utf-8");

        const { meta } = parseLessonDocument(content);
        const normalized = normalizeLessonMeta(
          meta,
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

        lessons.push({
          id: lessonId,
          ...normalized,
          content: content || createLessonContentTemplate(normalized),
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

function loadSeriesOrder(contentsDir: string): string[] {
  const orderFile = path.join(contentsDir, "_series-order.json");
  if (!fs.existsSync(orderFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(orderFile, "utf-8")) as string[];
  } catch {
    return [];
  }
}

function loadCourseMeta(courseDir: string): {
  target_audience: string;
  prerequisites: string[];
  next_courses: string[];
} {
  const metaFile = path.join(courseDir, "_course.json");
  if (!fs.existsSync(metaFile)) {
    return { target_audience: "", prerequisites: [], next_courses: [] };
  }
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
    return { target_audience: "", prerequisites: [], next_courses: [] };
  }
}

function numericPrefixSort(a: string, b: string): number {
  const na = parseInt(a.match(/^(\d+)/)?.[1] ?? "0", 10);
  const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? "0", 10);
  return na - nb;
}

function sortByOrder(items: string[], order: string[]): string[] {
  if (order.length === 0) return [...items].sort();
  const ordered = order.filter((name) => items.includes(name));
  const rest = items.filter((name) => !order.includes(name)).sort();
  return [...ordered, ...rest];
}
