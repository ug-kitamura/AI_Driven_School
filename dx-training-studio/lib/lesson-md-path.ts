import { resolveLessonFilePath, CONTENTS_DIR_NAME } from "@/lib/contents-loader";
import path from "node:path";

/**
 * git HEAD 参照用のレッスン .md 相対パス（`/` 区切り）。
 * `contents/` フォルダを走査して実際のファイルパスを解決する。
 * ファイルが見つからない場合は `contents/<series>/<course>/<lesson>.md` の推定パスを返す。
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
  return `${CONTENTS_DIR_NAME}/${sanitize(series)}/${sanitize(course)}/${sanitize(lesson)}.md`;
}
