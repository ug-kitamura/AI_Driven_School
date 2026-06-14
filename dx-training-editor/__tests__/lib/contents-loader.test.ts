import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadContentsFolder, contentsExists, getContentsFingerprint } from "@/lib/contents-loader";

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("loadContentsFolder", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "contents-loader-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when contents/ does not exist", () => {
    const result = loadContentsFolder(tmpDir);
    expect(result).toEqual([]);
  });

  it("returns empty array when contents/ is empty", () => {
    fs.mkdirSync(path.join(tmpDir, "contents"));
    const result = loadContentsFolder(tmpDir);
    expect(result).toEqual([]);
  });

  it("loads series, course and lessons from folder structure", () => {
    const contentsDir = path.join(tmpDir, "contents");
    const lessonContent = `---\nseries: テストシリーズ\ncourse: テストコース\nlesson: テストレッスン\nstatus: done\ndescription: テスト\ntags: [git]\nestimated_minutes: 10\nauthor: 田中\n---\n\n本文\n`;
    writeFile(
      path.join(contentsDir, "テストシリーズ", "01_テストコース", "01_テストレッスン.md"),
      lessonContent,
    );
    writeFile(
      path.join(contentsDir, "テストシリーズ", "01_テストコース", "_course.json"),
      JSON.stringify({ target_audience: "初心者", prerequisites: [], next_courses: [] }),
    );

    const result = loadContentsFolder(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("テストシリーズ");
    expect(result[0].courses).toHaveLength(1);
    expect(result[0].courses[0].name).toBe("テストコース");
    expect(result[0].courses[0].target_audience).toBe("初心者");
    expect(result[0].courses[0].lessons).toHaveLength(1);
    expect(result[0].courses[0].lessons[0].lesson).toBe("テストレッスン");
    expect(result[0].courses[0].lessons[0].status).toBe("done");
    expect(result[0].courses[0].lessons[0].tags).toEqual(["git"]);
  });

  it("falls back to folder path when frontmatter is broken", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(
      path.join(contentsDir, "シリーズA", "01_コースA", "01_レッスンA.md"),
      "フロントマターなし\n\n本文\n",
    );

    const result = loadContentsFolder(tmpDir);
    expect(result[0].courses[0].lessons[0].lesson).toBe("レッスンA");
    expect(result[0].courses[0].lessons[0].status).toBe("open");
  });

  it("writes template to disk when lesson file is empty", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "シリーズA", "01_コースA", "01_空.md"), "");

    loadContentsFolder(tmpDir);

    const onDisk = fs.readFileSync(
      path.join(contentsDir, "シリーズA", "01_コースA", "01_空.md"),
      "utf-8",
    );
    expect(onDisk.trimStart().startsWith("---")).toBe(true);
    expect(onDisk).toContain("# 空");
  });

  it("prefers filename over stale frontmatter lesson name", () => {
    const contentsDir = path.join(tmpDir, "contents");
    const lessonContent = `---\nseries: シリーズA\ncourse: コースA\nlesson: 古い名前\nstatus: open\ndescription: ""\ntags: []\nestimated_minutes: 0\nauthor: ""\n---\n\n本文\n`;
    writeFile(
      path.join(contentsDir, "シリーズA", "01_コースA", "01_新しい名前.md"),
      lessonContent,
    );

    const result = loadContentsFolder(tmpDir);
    expect(result[0].courses[0].lessons[0].lesson).toBe("新しい名前");
    expect(result[0].courses[0].lessons[0].id).toBe(
      "lesson-シリーズA-コースA-新しい名前",
    );
  });

  it("respects numeric prefixes for series ordering", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "02_シリーズB", ".keep"), "");
    writeFile(path.join(contentsDir, "01_シリーズA", ".keep"), "");

    const result = loadContentsFolder(tmpDir);
    expect(result[0].name).toBe("シリーズA");
    expect(result[1].name).toBe("シリーズB");
  });

  it("sorts courses by numeric prefix", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "S", "02_コースB", "_course.json"), "{}");
    writeFile(path.join(contentsDir, "S", "01_コースA", "_course.json"), "{}");

    const result = loadContentsFolder(tmpDir);
    expect(result[0].courses[0].name).toBe("コースA");
    expect(result[0].courses[1].name).toBe("コースB");
  });

  it("detects external lesson file rename via fingerprint", () => {
    const contentsDir = path.join(tmpDir, "contents");
    const lessonPath = path.join(
      contentsDir,
      "シリーズA",
      "01_コースA",
      "01_旧レッスン.md",
    );
    writeFile(lessonPath, "# old\n");

    const before = getContentsFingerprint(tmpDir);
    fs.renameSync(lessonPath, lessonPath.replace("旧レッスン", "新レッスン"));
    const after = getContentsFingerprint(tmpDir);

    expect(before).not.toBe(after);

    const result = loadContentsFolder(tmpDir);
    expect(result[0].courses[0].lessons[0].lesson).toBe("新レッスン");
  });
});

describe("contentsExists", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "contents-exists-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false when contents/ does not exist", () => {
    expect(contentsExists(tmpDir)).toBe(false);
  });

  it("returns true when contents/ exists", () => {
    fs.mkdirSync(path.join(tmpDir, "contents"));
    expect(contentsExists(tmpDir)).toBe(true);
  });
});
