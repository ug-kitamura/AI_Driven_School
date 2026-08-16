import fs from "node:fs";
import path from "node:path";
import { LESSON_CONTENTS_FILENAME } from "./lesson-paths";

export function migrateCourseDir(courseDir: string): number {
  let migrated = 0;
  const entries = fs.readdirSync(courseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === LESSON_CONTENTS_FILENAME) continue;

    const lessonName = entry.name.slice(0, -3);
    const sourcePath = path.join(courseDir, entry.name);
    const targetDir = path.join(courseDir, lessonName);
    const targetPath = path.join(targetDir, LESSON_CONTENTS_FILENAME);

    if (fs.existsSync(targetPath)) {
      continue;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.renameSync(sourcePath, targetPath);
    migrated += 1;
  }

  return migrated;
}

export function migrateAllLessonFolders(projectRoot: string): number {
  const contentsDir = path.join(projectRoot, "contents");
  if (!fs.existsSync(contentsDir)) return 0;

  let total = 0;
  for (const seriesEntry of fs.readdirSync(contentsDir, { withFileTypes: true })) {
    if (!seriesEntry.isDirectory()) continue;
    const seriesDir = path.join(contentsDir, seriesEntry.name);
    for (const courseEntry of fs.readdirSync(seriesDir, { withFileTypes: true })) {
      if (!courseEntry.isDirectory()) continue;
      total += migrateCourseDir(path.join(seriesDir, courseEntry.name));
    }
  }
  return total;
}
