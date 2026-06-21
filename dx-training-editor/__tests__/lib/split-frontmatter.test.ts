import { describe, expect, it } from "vitest";
import {
  alignLessonContentToDiskPath,
  getLessonBodyStartOffset,
  parseLessonDocument,
  splitFrontmatterText,
} from "@/lib/lesson-frontmatter";
import {
  findFrontmatterCloseLine,
  isFrontmatterDelimiterLine,
} from "@/lib/markdown-fold-ranges";

describe("isFrontmatterDelimiterLine", () => {
  it("accepts three or more hyphens", () => {
    expect(isFrontmatterDelimiterLine("---")).toBe(true);
    expect(isFrontmatterDelimiterLine("-----")).toBe(true);
    expect(isFrontmatterDelimiterLine("  ---  ")).toBe(true);
  });

  it("rejects one or two hyphens", () => {
    expect(isFrontmatterDelimiterLine("-")).toBe(false);
    expect(isFrontmatterDelimiterLine("--")).toBe(false);
  });
});

describe("splitFrontmatterText", () => {
  it("parses ----- delimiters", () => {
    const content = ["-----", "lesson: Sample", "-----", "", "# Body"].join(
      "\n",
    );
    const split = splitFrontmatterText(content);
    expect(split).not.toBeNull();
    expect(parseLessonDocument(content).body).toBe("\n# Body");
    expect(findFrontmatterCloseLine(content.split("\n"))).toBe(2);
    expect(getLessonBodyStartOffset(content)).toBe(
      "-----\nlesson: Sample\n-----\n".length,
    );
  });

  it("does not treat body horizontal rules as closing delimiter", () => {
    const content = ["# Title", "text", "---", "more"].join("\n");
    expect(splitFrontmatterText(content)).toBeNull();
  });
});

describe("alignLessonContentToDiskPath on body edit", () => {
  it("reserializes when FM lesson name differs from disk (save-time only)", () => {
    const ctx = { seriesName: "S", courseName: "C" };
    const typed = [
      "---",
      "series: S",
      "course: C",
      "lesson: OldName",
      "status: open",
      "description:",
      "tags: []",
      "estimated_minutes: 0",
      "author:",
      "---",
      "",
      "a",
      "# Title",
    ].join("\n");

    const aligned = alignLessonContentToDiskPath(typed, ctx, "DiskName");
    expect(aligned.ok).toBe(true);
    if (aligned.ok) {
      expect(aligned.content).toContain("lesson: DiskName");
      expect(aligned.content).toContain("a\n# Title");
      expect(aligned.content).not.toBe(typed);
    }
  });
});
