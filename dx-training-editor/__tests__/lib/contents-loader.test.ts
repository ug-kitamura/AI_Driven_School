import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadContentsFolder, contentsExists, getContentsFingerprint } from "@/lib/contents-loader";

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
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

  it("loads series, course and lessons from slug-based folder structure", () => {
    const contentsDir = path.join(tmpDir, "contents");
    const lessonContent = `---\nseries: test-series\ncourse: test-course\nlesson: test-lesson\nstatus: done\ndescription: テスト\ntags: [git]\nestimated_minutes: 10\nauthor: 田中\n---\n\n本文\n`;

    writeJson(path.join(contentsDir, "_series-order.json"), ["test-series"]);
    writeJson(path.join(contentsDir, "test-series", "_meta.json"), {
      title: { ja: "テストシリーズ" },
    });
    writeJson(path.join(contentsDir, "test-series", "_course-order.json"), ["test-course"]);
    writeJson(path.join(contentsDir, "test-series", "test-course", "_meta.json"), {
      title: { ja: "テストコース" },
      target_audience: { ja: "初心者" },
    });
    writeJson(path.join(contentsDir, "test-series", "test-course", "_mandala.json"), {
      prerequisites: [],
      next_courses: [],
    });
    writeJson(path.join(contentsDir, "test-series", "test-course", "_lesson-order.json"), ["test-lesson"]);
    writeFile(
      path.join(contentsDir, "test-series", "test-course", "test-lesson.md"),
      lessonContent,
    );

    const result = loadContentsFolder(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("テストシリーズ");
    expect(result[0].slug).toBe("test-series");
    expect(result[0].courses).toHaveLength(1);
    expect(result[0].courses[0].name).toBe("テストコース");
    expect(result[0].courses[0].slug).toBe("test-course");
    expect(result[0].courses[0].target_audience).toBe("初心者");
    expect(result[0].courses[0].lessons).toHaveLength(1);
    expect(result[0].courses[0].lessons[0].lesson).toBe("test-lesson");
    expect(result[0].courses[0].lessons[0].slug).toBe("test-lesson");
    expect(result[0].courses[0].lessons[0].status).toBe("done");
    expect(result[0].courses[0].lessons[0].tags).toEqual(["git"]);
  });

  it("uses slug as fallback title when _meta.json is missing", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeJson(path.join(contentsDir, "_series-order.json"), ["my-series"]);
    writeJson(path.join(contentsDir, "my-series", "_course-order.json"), ["my-course"]);
    writeJson(path.join(contentsDir, "my-series", "my-course", "_lesson-order.json"), ["my-lesson"]);
    writeFile(
      path.join(contentsDir, "my-series", "my-course", "my-lesson.md"),
      "フロントマターなし\n\n本文\n",
    );

    const result = loadContentsFolder(tmpDir);
    expect(result[0].name).toBe("my-series");
    expect(result[0].courses[0].name).toBe("my-course");
    expect(result[0].courses[0].lessons[0].lesson).toBe("my-lesson");
    expect(result[0].courses[0].lessons[0].status).toBe("open");
  });

  it("writes template to disk when lesson file is empty", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeJson(path.join(contentsDir, "_series-order.json"), ["my-series"]);
    writeJson(path.join(contentsDir, "my-series", "_course-order.json"), ["my-course"]);
    writeJson(path.join(contentsDir, "my-series", "my-course", "_lesson-order.json"), ["empty-lesson"]);
    writeFile(path.join(contentsDir, "my-series", "my-course", "empty-lesson.md"), "");

    loadContentsFolder(tmpDir);

    const onDisk = fs.readFileSync(
      path.join(contentsDir, "my-series", "my-course", "empty-lesson.md"),
      "utf-8",
    );
    expect(onDisk.trimStart().startsWith("---")).toBe(true);
  });

  it("respects _series-order.json for ordering", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeJson(path.join(contentsDir, "_series-order.json"), ["series-b", "series-a"]);
    fs.mkdirSync(path.join(contentsDir, "series-a"), { recursive: true });
    fs.mkdirSync(path.join(contentsDir, "series-b"), { recursive: true });

    const result = loadContentsFolder(tmpDir);
    expect(result[0].slug).toBe("series-b");
    expect(result[1].slug).toBe("series-a");
  });

  it("respects _course-order.json for ordering", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeJson(path.join(contentsDir, "_series-order.json"), ["s"]);
    writeJson(path.join(contentsDir, "s", "_course-order.json"), ["course-b", "course-a"]);
    fs.mkdirSync(path.join(contentsDir, "s", "course-a"), { recursive: true });
    fs.mkdirSync(path.join(contentsDir, "s", "course-b"), { recursive: true });

    const result = loadContentsFolder(tmpDir);
    expect(result[0].courses[0].slug).toBe("course-b");
    expect(result[0].courses[1].slug).toBe("course-a");
  });

  it("loads multilingual titles from _meta.json", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeJson(path.join(contentsDir, "_series-order.json"), ["my-series"]);
    writeJson(path.join(contentsDir, "my-series", "_meta.json"), {
      title: { ja: "マイシリーズ", en: "My Series" },
    });
    writeJson(path.join(contentsDir, "my-series", "_course-order.json"), ["my-course"]);
    writeJson(path.join(contentsDir, "my-series", "my-course", "_meta.json"), {
      title: { ja: "マイコース", en: "My Course" },
    });

    const result = loadContentsFolder(tmpDir);
    expect(result[0].name).toBe("マイシリーズ");
    expect(result[0].titleEn).toBe("My Series");
    expect(result[0].courses[0].name).toBe("マイコース");
    expect(result[0].courses[0].titleEn).toBe("My Course");
  });

  it("detects external lesson file rename via fingerprint", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeJson(path.join(contentsDir, "_series-order.json"), ["s"]);
    writeJson(path.join(contentsDir, "s", "_course-order.json"), ["c"]);
    writeJson(path.join(contentsDir, "s", "c", "_lesson-order.json"), ["old-lesson"]);
    const lessonPath = path.join(contentsDir, "s", "c", "old-lesson.md");
    writeFile(lessonPath, "# old\n");

    const before = getContentsFingerprint(tmpDir);
    fs.renameSync(lessonPath, path.join(path.dirname(lessonPath), "new-lesson.md"));
    const after = getContentsFingerprint(tmpDir);

    expect(before).not.toBe(after);
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
