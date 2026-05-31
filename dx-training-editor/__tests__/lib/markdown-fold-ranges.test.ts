import { describe, it, expect } from "vitest";
import {
  parseAtxHeading,
  findFrontmatterCloseLine,
  findHeadingFoldEndLine,
  getFoldRangeAtLine,
} from "@/lib/markdown-fold-ranges";

describe("parseAtxHeading", () => {
  it("returns level for ATX headings", () => {
    expect(parseAtxHeading("# Title")).toBe(1);
    expect(parseAtxHeading("###### Small")).toBe(6);
  });

  it("returns null for non-headings", () => {
    expect(parseAtxHeading("plain")).toBeNull();
    expect(parseAtxHeading("#no space")).toBeNull();
  });
});

describe("findFrontmatterCloseLine", () => {
  it("finds closing ---", () => {
    const lines = ["---", "series: x", "---", "# Body"];
    expect(findFrontmatterCloseLine(lines)).toBe(2);
  });

  it("returns null without frontmatter", () => {
    expect(findFrontmatterCloseLine(["# Hi"])).toBeNull();
  });
});

describe("findHeadingFoldEndLine", () => {
  it("stops at sibling or higher heading", () => {
    const lines = [
      "## A",
      "text",
      "### child",
      "more",
      "## B",
      "tail",
    ];
    expect(findHeadingFoldEndLine(lines, 0, 2)).toBe(3);
  });
});

describe("getFoldRangeAtLine", () => {
  it("folds frontmatter inner lines", () => {
    const lines = ["---", "k: v", "---", "## S"];
    expect(getFoldRangeAtLine(lines, 0)).toEqual({
      fromLineIndex: 1,
      toLineIndex: 2,
    });
  });

  it("folds content after heading until next same-or-higher", () => {
    const lines = ["## A", "body", "### sub", "x", "## B"];
    expect(getFoldRangeAtLine(lines, 0)).toEqual({
      fromLineIndex: 1,
      toLineIndex: 3,
    });
  });

  it("returns null when heading has no body", () => {
    expect(getFoldRangeAtLine(["## Only"], 0)).toBeNull();
  });
});
