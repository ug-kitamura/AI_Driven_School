import { describe, expect, it } from "vitest";
import { getLessonBodyStartOffset } from "@/lib/lesson-frontmatter";

describe("getLessonBodyStartOffset", () => {
  it("returns 0 without frontmatter", () => {
    expect(getLessonBodyStartOffset("# Title\n\nBody")).toBe(0);
  });

  it("returns offset after closing frontmatter delimiter", () => {
    const content = [
      "---",
      "lesson: Sample",
      "status: open",
      "---",
      "",
      "# Body",
    ].join("\n");
    expect(getLessonBodyStartOffset(content)).toBe(
      "---\nlesson: Sample\nstatus: open\n---\n".length,
    );
  });

  it("handles CRLF frontmatter", () => {
    const content = "---\r\nlesson: A\r\n---\r\n\r\nBody";
    expect(getLessonBodyStartOffset(content)).toBe(
      "---\r\nlesson: A\r\n---\r\n".length,
    );
  });
});
