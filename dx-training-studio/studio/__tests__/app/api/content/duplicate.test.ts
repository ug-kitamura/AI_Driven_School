import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { POST } from "@/app/api/content/duplicate/route";

const roots: string[] = [];
let cwdSpy: ReturnType<typeof vi.spyOn> | undefined;

afterEach(() => {
  cwdSpy?.mockRestore();
  for (const root of roots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  roots.length = 0;
});

const LESSON_MD = `---
series: Series
course: Course
lesson: Lesson A
slug: lesson-a
id: lsn-aaa
status: done
description: 説明
tags: []
estimated_minutes: 10
author: Kitamura
---
# 本文

これは本文です。
`;

/** contents/Series/Course/Lesson A を持つフィクスチャを作る */
function setup(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "duplicate-"));
  roots.push(root);
  // getProjectRoot() は cwd の親を返すため、cwd は root/studio 相当を指す
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));

  const courseDir = path.join(root, "contents", "Series", "Course");
  const lessonDir = path.join(courseDir, "Lesson A");
  fs.mkdirSync(lessonDir, { recursive: true });
  fs.writeFileSync(
    path.join(root, "contents", ".meta.json"),
    JSON.stringify({ order: ["Series"] }, null, 2),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(root, "contents", "Series", ".meta.json"),
    JSON.stringify({ order: ["Course"], id: "srs-xxx", slug: "series-x" }, null, 2),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(courseDir, ".meta.json"),
    JSON.stringify(
      { order: ["Lesson A"], id: "crs-yyy", slug: "course-y", target: "全員" },
      null,
      2,
    ),
    "utf-8",
  );
  fs.writeFileSync(path.join(lessonDir, "contents.md"), LESSON_MD, "utf-8");
  return root;
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/content/duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/content/duplicate", () => {
  it("レッスン複製は id / slug を落とし本文を保持する", async () => {
    const root = setup();
    const res = await post({
      type: "lesson",
      series: "Series",
      course: "Course",
      lesson: "Lesson A",
      targetSeries: "Series",
      targetCourse: "Course",
    });
    expect(res.status).toBe(200);

    const copied = fs.readFileSync(
      path.join(
        root,
        "contents",
        "Series",
        "Course",
        "Lesson A（コピー）",
        "contents.md",
      ),
      "utf-8",
    );
    expect(copied).not.toContain("id:");
    expect(copied).not.toContain("slug:");
    expect(copied).toContain("lesson: Lesson A（コピー）");
    expect(copied).toContain("これは本文です。");
    expect(copied).toContain("status: done");
  });

  it("受け入れ先 order の末尾に追加される", async () => {
    const root = setup();
    await post({
      type: "lesson",
      series: "Series",
      course: "Course",
      lesson: "Lesson A",
      targetSeries: "Series",
      targetCourse: "Course",
    });
    const meta = JSON.parse(
      fs.readFileSync(
        path.join(root, "contents", "Series", "Course", ".meta.json"),
        "utf-8",
      ),
    ) as { order: string[] };
    expect(meta.order).toEqual(["Lesson A", "Lesson A（コピー）"]);
  });

  it("名前衝突は（コピー2）で回避する", async () => {
    const root = setup();
    await post({
      type: "lesson",
      series: "Series",
      course: "Course",
      lesson: "Lesson A",
      targetSeries: "Series",
      targetCourse: "Course",
    });
    const res = await post({
      type: "lesson",
      series: "Series",
      course: "Course",
      lesson: "Lesson A",
      targetSeries: "Series",
      targetCourse: "Course",
    });
    expect(res.status).toBe(200);
    expect(
      fs.existsSync(
        path.join(root, "contents", "Series", "Course", "Lesson A（コピー2）"),
      ),
    ).toBe(true);
  });

  it("コース複製は配下レッスンの id / slug も落とす", async () => {
    const root = setup();
    const res = await post({
      type: "course",
      series: "Series",
      course: "Course",
      targetSeries: "Series",
    });
    expect(res.status).toBe(200);

    const copiedDir = path.join(root, "contents", "Series", "Course（コピー）");
    const courseMeta = JSON.parse(
      fs.readFileSync(path.join(copiedDir, ".meta.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(courseMeta.id).toBeUndefined();
    expect(courseMeta.slug).toBeUndefined();
    expect(courseMeta.target).toBe("全員");

    const copiedLesson = fs.readFileSync(
      path.join(copiedDir, "Lesson A", "contents.md"),
      "utf-8",
    );
    expect(copiedLesson).not.toContain("id:");
    expect(copiedLesson).not.toContain("slug:");
    expect(copiedLesson).toContain("course: Course（コピー）");
  });

  it("元のエンティティは変化しない", async () => {
    const root = setup();
    await post({
      type: "course",
      series: "Series",
      course: "Course",
      targetSeries: "Series",
    });
    const original = fs.readFileSync(
      path.join(root, "contents", "Series", "Course", "Lesson A", "contents.md"),
      "utf-8",
    );
    expect(original).toBe(LESSON_MD);
    const originalMeta = JSON.parse(
      fs.readFileSync(
        path.join(root, "contents", "Series", "Course", ".meta.json"),
        "utf-8",
      ),
    ) as Record<string, unknown>;
    expect(originalMeta.id).toBe("crs-yyy");
  });

  it("シリーズ複製はルート order の末尾に付き全階層の id / slug を落とす", async () => {
    const root = setup();
    const res = await post({ type: "series", series: "Series" });
    expect(res.status).toBe(200);

    const rootMeta = JSON.parse(
      fs.readFileSync(path.join(root, "contents", ".meta.json"), "utf-8"),
    ) as { order: string[] };
    expect(rootMeta.order).toEqual(["Series", "Series（コピー）"]);

    const seriesMeta = JSON.parse(
      fs.readFileSync(
        path.join(root, "contents", "Series（コピー）", ".meta.json"),
        "utf-8",
      ),
    ) as Record<string, unknown>;
    expect(seriesMeta.id).toBeUndefined();
    expect(seriesMeta.slug).toBeUndefined();

    const copiedLesson = fs.readFileSync(
      path.join(
        root,
        "contents",
        "Series（コピー）",
        "Course",
        "Lesson A",
        "contents.md",
      ),
      "utf-8",
    );
    expect(copiedLesson).not.toContain("id:");
    expect(copiedLesson).toContain("series: Series（コピー）");
  });
});
