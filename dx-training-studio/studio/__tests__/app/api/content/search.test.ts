import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET } from "@/app/api/content/search/route";

const roots: string[] = [];
let cwdSpy: ReturnType<typeof vi.spyOn> | undefined;

afterEach(() => {
  cwdSpy?.mockRestore();
  for (const root of roots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  roots.length = 0;
});

function lessonMd(lesson: string, body: string): string {
  return `---
series: Git基礎
course: Git概念
lesson: ${lesson}
status: open
description: ""
tags: []
estimated_minutes: 10
author: Kitamura
---
${body}
`;
}

/** contents/Git基礎/Git概念/{レッスン2本} を持つフィクスチャを作る */
function setup(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "content-search-"));
  roots.push(root);
  // getProjectRoot() は cwd の親を返すため、cwd は root/studio 相当を指す
  cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(path.join(root, "studio"));

  const courseDir = path.join(root, "contents", "Git基礎", "Git概念");
  fs.mkdirSync(path.join(courseDir, "三大エリア"), { recursive: true });
  fs.mkdirSync(path.join(courseDir, "コミット入門"), { recursive: true });
  fs.writeFileSync(
    path.join(courseDir, "三大エリア", "contents.md"),
    lessonMd("三大エリア", "ワークツリーとステージの説明。"),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(courseDir, "コミット入門", "contents.md"),
    lessonMd("コミット入門", "セーブポイントを作る操作です。"),
    "utf-8",
  );
  return root;
}

function get(q: string) {
  return GET(
    new Request(
      `http://localhost/api/content/search?q=${encodeURIComponent(q)}`,
    ),
  );
}

async function json(res: Response) {
  return (await res.json()) as {
    matches: Array<{ series: string; course?: string; lesson?: string }>;
    truncated: boolean;
  };
}

describe("GET /api/content/search", () => {
  it("レッスン本文の部分一致でレッスンを返す", async () => {
    setup();
    const data = await json(await get("セーブポイント"));
    expect(data.matches).toEqual([
      { series: "Git基礎", course: "Git概念", lesson: "コミット入門" },
    ]);
    expect(data.truncated).toBe(false);
  });

  it("大文字小文字を無視して一致する", async () => {
    setup();
    const data = await json(await get("git基礎"));
    expect(data.matches).toEqual([{ series: "Git基礎" }]);
  });

  it("コース名の一致はコースとして返す", async () => {
    setup();
    const data = await json(await get("Git概念"));
    expect(data.matches).toEqual([{ series: "Git基礎", course: "Git概念" }]);
  });

  it("空クエリは空の一致を返す", async () => {
    setup();
    const data = await json(await get("  "));
    expect(data.matches).toEqual([]);
    expect(data.truncated).toBe(false);
  });

  it("一致しなければ空", async () => {
    setup();
    const data = await json(await get("存在しない語"));
    expect(data.matches).toEqual([]);
  });
});
