import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findLessonContentInSeriesJson,
  toRepoRelativePath,
} from "@/lib/lesson-head-content";

describe("toRepoRelativePath", () => {
  it("returns path unchanged when project root is repo root", () => {
    const root = path.resolve("/repo/dx-training-editor");
    expect(toRepoRelativePath(root, root, "data/content.json")).toBe(
      "data/content.json",
    );
  });

  it("prefixes project directory in monorepo", () => {
    const repo = path.resolve("/repo");
    const project = path.resolve("/repo/dx-training-editor");
    expect(toRepoRelativePath(project, repo, "data/content.json")).toBe(
      "dx-training-editor/data/content.json",
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
          prerequisites: [],
          next_courses: [],
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
