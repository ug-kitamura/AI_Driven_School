import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrateLessonDir } from "@/scripts/migrate-lesson-meta";

const LESSON_MD = `---
series: Git基礎シリーズ
course: Git概念コース
lesson: Gitの三大エリア
slug: three-areas
id: lsn-three-areas-unvulm
status: done
description: 3つの場所を説明できるようになる
tags: [git, concepts]
estimated_minutes: 15
author: Kitamura
---

# Gitの三大エリア

本文です。
`;

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

function makeLessonDir(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "migrate-lesson-meta-"));
  tmpDirs.push(dir);
  fs.writeFileSync(path.join(dir, "contents.md"), content, "utf-8");
  return dir;
}

describe("migrateLessonDir", () => {
  it("frontmatter を剥がして .meta.json を生成する（名前3つは捨てる）", () => {
    const dir = makeLessonDir(LESSON_MD);
    expect(migrateLessonDir(dir)).toBe(true);

    const body = fs.readFileSync(path.join(dir, "contents.md"), "utf-8");
    expect(body).toBe("# Gitの三大エリア\n\n本文です。\n");

    const meta = JSON.parse(
      fs.readFileSync(path.join(dir, ".meta.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(meta.id).toBe("lsn-three-areas-unvulm");
    expect(meta.slug).toBe("three-areas");
    expect(meta.status).toBe("done");
    expect(meta.tags).toEqual(["git", "concepts"]);
    expect(meta.estimated_minutes).toBe(15);
    expect(meta.author).toBe("Kitamura");
    expect(meta).not.toHaveProperty("series");
    expect(meta).not.toHaveProperty("course");
    expect(meta).not.toHaveProperty("lesson");
  });

  it("旧ステータス draft は open へ読み替える", () => {
    const dir = makeLessonDir("---\nstatus: draft\n---\n\n本文\n");
    migrateLessonDir(dir);
    const meta = JSON.parse(
      fs.readFileSync(path.join(dir, ".meta.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(meta.status).toBe("open");
  });

  it("frontmatter が無いレッスンは変更しない（冪等）", () => {
    const dir = makeLessonDir("# 本文のみ\n");
    expect(migrateLessonDir(dir)).toBe(false);
    expect(fs.readFileSync(path.join(dir, "contents.md"), "utf-8")).toBe(
      "# 本文のみ\n",
    );
    expect(fs.existsSync(path.join(dir, ".meta.json"))).toBe(false);
  });

  it("2回実行しても結果が変わらない", () => {
    const dir = makeLessonDir(LESSON_MD);
    migrateLessonDir(dir);
    const bodyAfterFirst = fs.readFileSync(path.join(dir, "contents.md"), "utf-8");
    const metaAfterFirst = fs.readFileSync(path.join(dir, ".meta.json"), "utf-8");

    expect(migrateLessonDir(dir)).toBe(false);
    expect(fs.readFileSync(path.join(dir, "contents.md"), "utf-8")).toBe(
      bodyAfterFirst,
    );
    expect(fs.readFileSync(path.join(dir, ".meta.json"), "utf-8")).toBe(
      metaAfterFirst,
    );
  });
});
