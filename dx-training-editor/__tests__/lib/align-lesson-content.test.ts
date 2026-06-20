import { describe, expect, it } from "vitest";
import { alignLessonContentToDiskPath } from "@/lib/lesson-frontmatter";

const ctx = {
  seriesName: "Python基礎シリーズ",
  courseName: "Python環境構築コース",
};

describe("alignLessonContentToDiskPath", () => {
  it("rejects content whose FM course differs from disk location", () => {
    const content = [
      "---",
      "series: Python基礎シリーズ",
      "course: Python基礎コース",
      "lesson: Pythonとは何か",
      "status: open",
      "description:",
      "tags: []",
      "estimated_minutes: 0",
      "author:",
      "---",
      "",
      "# Pythonとは何か",
    ].join("\n");

    const result = alignLessonContentToDiskPath(
      content,
      ctx,
      "Pythonのインストール",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Python基礎コース");
    }
  });

  it("aligns FM lesson name to disk filename without blocking", () => {
    const content = [
      "---",
      "series: Python基礎シリーズ",
      "course: Python環境構築コース",
      "lesson: Pythonとは何か",
      "status: open",
      "description:",
      "tags: []",
      "estimated_minutes: 0",
      "author:",
      "---",
      "",
      "# body",
    ].join("\n");

    const result = alignLessonContentToDiskPath(
      content,
      ctx,
      "Pythonのインストール",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain("lesson: Pythonのインストール");
      expect(result.content).not.toContain("lesson: Pythonとは何か");
    }
  });
});
