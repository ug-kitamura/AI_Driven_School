import { describe, expect, it } from "vitest";
import { extractMarkdownBlock } from "@/lib/extract-markdown-block";

describe("extractMarkdownBlock", () => {
  it("extracts fenced markdown block", () => {
    const input = "説明文\n\n```markdown\n# Title\n\nBody\n```\n\n後書き";
    const result = extractMarkdownBlock(input);
    expect(result).toBe("# Title\n\nBody");
  });

  it("falls back to full content when no fence", () => {
    expect(extractMarkdownBlock("# Title")).toBe("# Title");
  });

  it("strips four-backtick wrapper and inner markdown fences", () => {
    const input = [
      "````markdown",
      "```markdown",
      "---",
      "series: Example",
      "---",
      "",
      "# Title",
      "```",
      "````",
    ].join("\n");

    const result = extractMarkdownBlock(input);
    expect(result).toBe(
      ["---", "series: Example", "---", "", "# Title"].join("\n"),
    );
    expect(result).not.toContain("```markdown");
    expect(result).not.toMatch(/^```/m);
  });

  it("extracts full draft with nested code blocks", () => {
    const input = [
      "````markdown",
      "```markdown",
      "---",
      "series: Example",
      "---",
      "",
      "# Title",
      "",
      "```bash",
      "conda --version",
      "```",
      "",
      "Tail section",
      "```",
      "````",
    ].join("\n");

    const result = extractMarkdownBlock(input);
    expect(result).toContain("```bash\nconda --version\n```");
    expect(result).toContain("Tail section");
    expect(result).not.toContain("```markdown");
  });
});
