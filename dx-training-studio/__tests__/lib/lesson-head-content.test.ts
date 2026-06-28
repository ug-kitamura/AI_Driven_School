import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  findLessonContentInSeriesJson,
  resolveHeadContent,
  toRepoRelativePath,
} from "@/lib/lesson-head-content";

describe("toRepoRelativePath", () => {
  it("returns path unchanged when project root is repo root", () => {
    const root = path.resolve("/repo/dx-training-studio");
    expect(toRepoRelativePath(root, root, "data/content.json")).toBe(
      "data/content.json",
    );
  });

  it("prefixes project directory in monorepo", () => {
    const repo = path.resolve("/repo");
    const project = path.resolve("/repo/dx-training-studio");
    expect(toRepoRelativePath(project, repo, "data/content.json")).toBe(
      "dx-training-studio/data/content.json",
    );
  });
});

describe("findLessonContentInSeriesJson", () => {
  const sample = [
    {
      id: "s1",
      name: "Series",
      courses: [
        {
          id: "c1",
          name: "Course",
          cross_series_prev: [],
          cross_series_next: [],
          lessons: [
            {
              id: "l1",
              series: "Series",
              course: "Course",
              lesson: "Lesson",
              status: "open",
              description: "",
              tags: [],
              estimated_minutes: 0,
              author: "",
              content: "head content",
            },
          ],
        },
      ],
    },
  ];

  it("finds lesson content by id", () => {
    expect(findLessonContentInSeriesJson(sample, "l1")).toBe("head content");
  });

  it("returns null when lesson id is missing", () => {
    expect(findLessonContentInSeriesJson(sample, "missing")).toBeNull();
  });

  it("returns null for invalid json shape", () => {
    expect(findLessonContentInSeriesJson([], "l1")).toBeNull();
  });
});

describe("resolveHeadContent integration", () => {
  it("resolves git-md for course names containing spaces", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-head-content-"));
    try {
      execFileSync("git", ["init"], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: root, stdio: "pipe" });

      const rel = "contents/はじめにシリーズ/DX piyopiyo コース/トレーニングの進め方/contents.md";
      const absolute = path.join(root, rel);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, "# training\n", "utf-8");
      execFileSync("git", ["add", "."], { cwd: root, stdio: "pipe" });
      execFileSync("git", ["commit", "-m", "init"], { cwd: root, stdio: "pipe" });

      const result = resolveHeadContent(
        root,
        "unused-lesson-id",
        "はじめにシリーズ",
        "DX piyopiyo コース",
        "トレーニングの進め方",
      );
      if ("error" in result) {
        expect.fail(`git error: ${result.error}`);
      }
      expect(result.headSource).toBe("git-md");
      expect(result.content.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
