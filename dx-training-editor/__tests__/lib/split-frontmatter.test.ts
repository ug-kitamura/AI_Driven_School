import { describe, expect, it } from "vitest";
import {
  alignLessonContentToDiskPath,
  getLessonBodyStartOffset,
  parseLessonDocument,
  serializeLessonDocument,
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

describe("serializeLessonDocument", () => {
  const meta = {
    series: "S",
    course: "C",
    lesson: "L",
    status: "open" as const,
    description: "",
    tags: [] as string[],
    estimated_minutes: 0,
    author: "",
  };

  it("does not inject a blank line after closing frontmatter", () => {
    const doc = serializeLessonDocument(meta, "hello\n# Title");
    expect(doc).toContain("---\nhello");
    expect(doc).not.toMatch(/---\n\nhello/);
  });

  it("preserves an intentional blank line after frontmatter", () => {
    const doc = serializeLessonDocument(meta, "\n# Title");
    expect(doc).toContain("---\n\n# Title");
  });

  it("round-trips body on line 11 without adding blank lines", () => {
    const content = [
      "---",
      "series: S",
      "course: C",
      "lesson: L",
      "status: open",
      "description:",
      "tags: []",
      "estimated_minutes: 0",
      "author:",
      "---",
      "typed on line 11",
      "# Title",
    ].join("\n");
    const { meta: parsed, body } = parseLessonDocument(content);
    const realigned = serializeLessonDocument(
      {
        series: parsed.series ?? "S",
        course: parsed.course ?? "C",
        lesson: parsed.lesson ?? "L",
        status: parsed.status ?? "open",
        description: parsed.description ?? "",
        tags: parsed.tags ?? [],
        estimated_minutes: parsed.estimated_minutes ?? 0,
        author: parsed.author ?? "",
      },
      body,
    );
    expect(realigned).toContain("---\ntyped on line 11");
    expect(realigned).not.toMatch(/---\n\ntyped on line 11/);
    expect(parseLessonDocument(realigned).body).toBe(body);
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
      "a",
      "# Title",
    ].join("\n");

    const aligned = alignLessonContentToDiskPath(typed, ctx, "DiskName");
    expect(aligned.ok).toBe(true);
    if (aligned.ok) {
      expect(aligned.content).toContain("lesson: DiskName");
      expect(aligned.content).toContain("a\n# Title");
      expect(aligned.content).not.toMatch(/---\n\na/);
    }
  });
});
