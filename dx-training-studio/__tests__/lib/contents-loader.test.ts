import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadContentsFolder,
  contentsExists,
  getContentsFingerprint,
  reconcileOrderFiles,
} from "@/lib/contents-loader";
import { LESSON_CONTENTS_FILENAME, LESSON_SESSION_FILENAME } from "@/lib/lesson-paths";

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

function writeJson(filePath: string, data: unknown) {
  writeFile(filePath, JSON.stringify(data, null, 2));
}

function writeLesson(
  contentsDir: string,
  series: string,
  course: string,
  lesson: string,
  content: string,
) {
  writeFile(
    path.join(contentsDir, series, course, lesson, LESSON_CONTENTS_FILENAME),
    content,
  );
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
    writeLesson(contentsDir, "テストシリーズ", "テストコース", "テストレッスン", lessonContent);
    writeJson(
      path.join(contentsDir, "テストシリーズ", "テストコース", ".meta.json"),
      { order: ["テストレッスン"], target: "初心者", cross_series_prev: [], cross_series_next: [] },
    );
    writeJson(path.join(contentsDir, "テストシリーズ", ".meta.json"), { order: ["テストコース"] });
    writeJson(path.join(contentsDir, ".meta.json"), { order: ["テストシリーズ"] });

    const result = loadContentsFolder(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("テストシリーズ");
    expect(result[0].courses).toHaveLength(1);
    expect(result[0].courses[0].name).toBe("テストコース");
    expect(result[0].courses[0].target).toBe("初心者");
    expect(result[0].courses[0].lessons).toHaveLength(1);
    expect(result[0].courses[0].lessons[0].lesson).toBe("テストレッスン");
    expect(result[0].courses[0].lessons[0].status).toBe("done");
    expect(result[0].courses[0].lessons[0].tags).toEqual(["git"]);
  });

  describe("コースの受講形態 style", () => {
    function loadCourseWithStyle(meta: Record<string, unknown>) {
      const contentsDir = path.join(tmpDir, "contents");
      const lessonContent = `---\nseries: S\ncourse: C\nlesson: L\nstatus: done\ndescription: d\ntags: []\nestimated_minutes: 10\nauthor: a\n---\n\n本文\n`;
      writeLesson(contentsDir, "S", "C", "L", lessonContent);
      writeJson(path.join(contentsDir, "S", "C", ".meta.json"), {
        order: ["L"],
        ...meta,
      });
      writeJson(path.join(contentsDir, "S", ".meta.json"), { order: ["C"] });
      writeJson(path.join(contentsDir, ".meta.json"), { order: ["S"] });
      return loadContentsFolder(tmpDir)[0].courses[0];
    }

    it("語彙内の style を読み込む", () => {
      expect(loadCourseWithStyle({ style: "hands-on" }).style).toBe("hands-on");
    });

    it("style キーが無くても読み込みは成功し未設定になる", () => {
      expect(loadCourseWithStyle({}).style).toBeUndefined();
    });

    it("語彙外の style は未設定として扱う", () => {
      expect(loadCourseWithStyle({ style: "seminar" }).style).toBeUndefined();
    });
  });

  it("falls back to folder path when frontmatter is broken", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeLesson(contentsDir, "シリーズA", "コースA", "レッスンA", "フロントマターなし\n\n本文\n");
    writeJson(path.join(contentsDir, "シリーズA", "コースA", ".meta.json"), { order: ["レッスンA"] });

    const result = loadContentsFolder(tmpDir);
    expect(result[0].courses[0].lessons[0].lesson).toBe("レッスンA");
    expect(result[0].courses[0].lessons[0].status).toBe("open");
  });

  it("writes template to disk when lesson file is empty", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeLesson(contentsDir, "シリーズA", "コースA", "空", "");
    writeJson(path.join(contentsDir, "シリーズA", "コースA", ".meta.json"), { order: ["空"] });

    loadContentsFolder(tmpDir);

    const onDisk = fs.readFileSync(
      path.join(contentsDir, "シリーズA", "コースA", "空", LESSON_CONTENTS_FILENAME),
      "utf-8",
    );
    expect(onDisk.trimStart().startsWith("---")).toBe(true);
    expect(onDisk).toContain("# 空");
  });

  it("prefers folder name over stale frontmatter lesson name", () => {
    const contentsDir = path.join(tmpDir, "contents");
    const lessonContent = `---\nseries: シリーズA\ncourse: コースA\nlesson: 古い名前\nstatus: open\ndescription: ""\ntags: []\nestimated_minutes: 0\nauthor: ""\n---\n\n本文\n`;
    writeLesson(contentsDir, "シリーズA", "コースA", "新しい名前", lessonContent);
    writeJson(path.join(contentsDir, "シリーズA", "コースA", ".meta.json"), { order: ["新しい名前"] });

    const result = loadContentsFolder(tmpDir);
    expect(result[0].courses[0].lessons[0].lesson).toBe("新しい名前");
    expect(result[0].courses[0].lessons[0].id).toBe(
      "lesson-シリーズA-コースA-新しい名前",
    );
  });

  it("reads stable ids from .meta.json when present", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeLesson(contentsDir, "テストシリーズ", "テストコース", "L", "# L\n");
    writeJson(path.join(contentsDir, "テストシリーズ", "テストコース", ".meta.json"), {
      id: "crs-test-course-abc123",
      order: ["L"],
      cross_series_prev: [],
      cross_series_next: [],
    });
    writeJson(path.join(contentsDir, "テストシリーズ", ".meta.json"), {
      id: "srs-test-series-def456",
      order: ["テストコース"],
    });
    writeJson(path.join(contentsDir, ".meta.json"), { order: ["テストシリーズ"] });

    const result = loadContentsFolder(tmpDir);
    expect(result[0].id).toBe("srs-test-series-def456");
    expect(result[0].courses[0].id).toBe("crs-test-course-abc123");
  });

  it("generates and persists stable ids when missing from .meta.json", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeLesson(contentsDir, "S", "C", "L", "# L\n");
    writeJson(path.join(contentsDir, "S", "C", ".meta.json"), {
      order: ["L"],
      cross_series_prev: [],
      cross_series_next: [],
    });
    writeJson(path.join(contentsDir, "S", ".meta.json"), { order: ["C"] });
    writeJson(path.join(contentsDir, ".meta.json"), { order: ["S"] });

    const result = loadContentsFolder(tmpDir);
    expect(result[0].id).toMatch(/^srs-/);
    expect(result[0].courses[0].id).toMatch(/^crs-/);

    const seriesMeta = JSON.parse(
      fs.readFileSync(path.join(contentsDir, "S", ".meta.json"), "utf-8"),
    ) as { id: string };
    const courseMeta = JSON.parse(
      fs.readFileSync(path.join(contentsDir, "S", "C", ".meta.json"), "utf-8"),
    ) as { id: string };
    expect(seriesMeta.id).toBe(result[0].id);
    expect(courseMeta.id).toBe(result[0].courses[0].id);
  });

  it("respects .meta.json order for series", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "シリーズA", ".keep"), "");
    writeFile(path.join(contentsDir, "シリーズB", ".keep"), "");
    writeJson(path.join(contentsDir, ".meta.json"), { order: ["シリーズB", "シリーズA"] });

    const result = loadContentsFolder(tmpDir);
    expect(result[0].name).toBe("シリーズB");
    expect(result[1].name).toBe("シリーズA");
  });

  it("falls back to alphabetical order when no .meta.json order exists", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "シリーズB", ".keep"), "");
    writeFile(path.join(contentsDir, "シリーズA", ".keep"), "");

    const result = loadContentsFolder(tmpDir);
    expect(result[0].name).toBe("シリーズA");
    expect(result[1].name).toBe("シリーズB");
  });

  it("respects .meta.json order for courses", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "S", "コースA", "_keep"), "");
    writeFile(path.join(contentsDir, "S", "コースB", "_keep"), "");
    writeJson(path.join(contentsDir, "S", ".meta.json"), { order: ["コースB", "コースA"] });

    const result = loadContentsFolder(tmpDir);
    expect(result[0].courses[0].name).toBe("コースB");
    expect(result[0].courses[1].name).toBe("コースA");
  });

  it("detects external lesson folder rename via fingerprint", () => {
    const contentsDir = path.join(tmpDir, "contents");
    const lessonDir = path.join(contentsDir, "シリーズA", "コースA", "旧レッスン");
    writeFile(path.join(lessonDir, LESSON_CONTENTS_FILENAME), "# old\n");

    const before = getContentsFingerprint(tmpDir);
    fs.renameSync(lessonDir, path.join(contentsDir, "シリーズA", "コースA", "新レッスン"));
    const after = getContentsFingerprint(tmpDir);

    expect(before).not.toBe(after);
  });

  it("ignores session.json changes in fingerprint", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(
      path.join(contentsDir, "S", "C", "L", LESSON_CONTENTS_FILENAME),
      "# L\n",
    );

    const before = getContentsFingerprint(tmpDir);
    writeFile(
      path.join(contentsDir, "S", "C", "L", LESSON_SESSION_FILENAME),
      '{"version":1}\n',
    );
    const after = getContentsFingerprint(tmpDir);

    expect(before).toBe(after);
  });
});

describe("reconcileOrderFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes stale entries from order", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "シリーズA", ".keep"), "");
    writeJson(path.join(contentsDir, ".meta.json"), { order: ["シリーズA", "シリーズB"] });

    reconcileOrderFiles(tmpDir);

    const meta = JSON.parse(fs.readFileSync(path.join(contentsDir, ".meta.json"), "utf-8")) as { order: string[] };
    expect(meta.order).toEqual(["シリーズA"]);
  });

  it("appends new directories to order", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "シリーズA", ".keep"), "");
    writeFile(path.join(contentsDir, "シリーズB", ".keep"), "");
    writeJson(path.join(contentsDir, ".meta.json"), { order: ["シリーズA"] });

    reconcileOrderFiles(tmpDir);

    const meta = JSON.parse(fs.readFileSync(path.join(contentsDir, ".meta.json"), "utf-8")) as { order: string[] };
    expect(meta.order).toEqual(["シリーズA", "シリーズB"]);
  });

  it("does not modify .meta.json when nothing changed", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "シリーズA", ".keep"), "");
    writeJson(path.join(contentsDir, ".meta.json"), { order: ["シリーズA"] });
    const mtimeBefore = fs.statSync(path.join(contentsDir, ".meta.json")).mtimeMs;

    reconcileOrderFiles(tmpDir);

    const mtimeAfter = fs.statSync(path.join(contentsDir, ".meta.json")).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });

  it("does not rename or modify any directories", () => {
    const contentsDir = path.join(tmpDir, "contents");
    writeFile(path.join(contentsDir, "シリーズA", ".keep"), "");
    writeJson(path.join(contentsDir, ".meta.json"), { order: ["シリーズA", "存在しない"] });

    reconcileOrderFiles(tmpDir);

    expect(fs.existsSync(path.join(contentsDir, "シリーズA"))).toBe(true);
    expect(fs.existsSync(path.join(contentsDir, "存在しない"))).toBe(false);
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

/**
 * 中間ファイル置き場（`_work/`）がシリーズ・コースとして画面に現れないこと。
 * 判定はディレクトリ名だけで行うため、誰が作ったかを問わない（`contents-write-gate`）。
 */
describe("アンダースコア・ドット始まりのディレクトリ除外", () => {
  let tmpDir: string;
  let contentsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "contents-hidden-test-"));
    contentsDir = path.join(tmpDir, "contents");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("contents/_work/ はシリーズにならない", () => {
    writeLesson(contentsDir, "シリーズA", "コースB", "レッスンC", "本文");
    writeFile(path.join(contentsDir, "_work", "report.html"), "x");

    const result = loadContentsFolder(tmpDir);
    expect(result.map((s) => s.name)).toEqual(["シリーズA"]);
  });

  it("シリーズ配下の _work/ はコースにならない", () => {
    writeLesson(contentsDir, "シリーズA", "コースB", "レッスンC", "本文");
    writeFile(path.join(contentsDir, "シリーズA", "_work", "note.md"), "x");

    const result = loadContentsFolder(tmpDir);
    expect(result[0]?.courses.map((c) => c.name)).toEqual(["コースB"]);
  });

  it("コース配下の _work/ はレッスンにならない", () => {
    writeLesson(contentsDir, "シリーズA", "コースB", "レッスンC", "本文");
    writeFile(
      path.join(contentsDir, "シリーズA", "コースB", "_work", LESSON_CONTENTS_FILENAME),
      "x",
    );

    const result = loadContentsFolder(tmpDir);
    expect(result[0]?.courses[0]?.lessons.map((l) => l.lesson)).toEqual([
      "レッスンC",
    ]);
  });

  it("ドット始まりのディレクトリも除外される", () => {
    writeLesson(contentsDir, "シリーズA", "コースB", "レッスンC", "本文");
    writeFile(path.join(contentsDir, ".tmp", "x.md"), "x");

    const result = loadContentsFolder(tmpDir);
    expect(result.map((s) => s.name)).toEqual(["シリーズA"]);
  });

  it("order に残った _work は無視される", () => {
    writeLesson(contentsDir, "シリーズA", "コースB", "レッスンC", "本文");
    writeFile(path.join(contentsDir, "_work", "report.html"), "x");
    writeJson(path.join(contentsDir, ".meta.json"), {
      order: ["_work", "シリーズA"],
    });

    const result = loadContentsFolder(tmpDir);
    expect(result.map((s) => s.name)).toEqual(["シリーズA"]);
  });

  it("reconcileOrderFiles は _work を order へ書き込まない", () => {
    writeLesson(contentsDir, "シリーズA", "コースB", "レッスンC", "本文");
    writeFile(path.join(contentsDir, "_work", "report.html"), "x");

    reconcileOrderFiles(tmpDir);

    const meta = JSON.parse(
      fs.readFileSync(path.join(contentsDir, ".meta.json"), "utf-8"),
    );
    expect(meta.order).not.toContain("_work");
  });

  it("通常のフォルダは従来どおり読み込まれ、.meta.json も読まれる", () => {
    writeLesson(contentsDir, "シリーズA", "コースB", "レッスンC", "本文");
    writeLesson(contentsDir, "シリーズA", "コースB", "レッスンD", "本文");
    writeJson(path.join(contentsDir, "シリーズA", "コースB", ".meta.json"), {
      order: ["レッスンD", "レッスンC"],
      target: "初学者",
    });

    const result = loadContentsFolder(tmpDir);
    const course = result[0]?.courses[0];
    expect(course?.lessons.map((l) => l.lesson)).toEqual([
      "レッスンD",
      "レッスンC",
    ]);
    expect(course?.target).toBe("初学者");
  });
});
