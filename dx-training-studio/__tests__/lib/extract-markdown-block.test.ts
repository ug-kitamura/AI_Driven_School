import { describe, expect, it } from "vitest";
import { extractMarkdownBlock } from "@/lib/extract-markdown-block";

describe("extractMarkdownBlock", () => {
  it("extracts fenced markdown block", () => {
    const input = "説明文\n\n```markdown\n# Title\n\nBody\n```\n\n後書き";
    expect(extractMarkdownBlock(input)).toBe("# Title\n\nBody");
  });

  it("falls back to full content when no fence", () => {
    expect(extractMarkdownBlock("# Title")).toBe("# Title");
  });
});
