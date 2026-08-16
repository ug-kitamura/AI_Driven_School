import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { migrateCourseDir } from "@/lib/migrate-lesson-folders";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("migrate-lesson-folders", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "migrate-lesson-folders-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("moves flat md into lesson folder contents.md", () => {
    const courseDir = path.join(tmpDir, "contents", "S", "C");
    writeFile(path.join(courseDir, "L.md"), "# lesson\n");
    const migrated = migrateCourseDir(courseDir);
    expect(migrated).toBe(1);
    expect(fs.existsSync(path.join(courseDir, "L.md"))).toBe(false);
    expect(fs.existsSync(path.join(courseDir, "L", LESSON_CONTENTS_FILENAME))).toBe(true);
  });
});
