import { resolveLessonFilePath, CONTENTS_DIR_NAME } from "@/lib/contents-loader";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";
import path from "node:path";

/**
 * git HEAD 参照用のレッスン contents.md 相対パス（`/` 区切り）。
 */
export function resolveLessonMdPath(
  series: string,
  course: string,
  lesson: string,
): string {
  const projectRoot = process.cwd();
  const absolutePath = resolveLessonFilePath(projectRoot, series, course, lesson);
  if (absolutePath) {
    return path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
  }
  const sanitize = (n: string) => n.replace(/[/\\:*?"<>|]/g, "_").trim();
  return `${CONTENTS_DIR_NAME}/${sanitize(series)}/${sanitize(course)}/${sanitize(lesson)}/${LESSON_CONTENTS_FILENAME}`;
}
