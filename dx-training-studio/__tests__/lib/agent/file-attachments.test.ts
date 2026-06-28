import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  extractAttachmentTokens,
  isAllowedContentMdPath,
  listContentMarkdownFiles,
  orderContentFilesForPicker,
  readAttachmentContents,
  resolveAllowedContentPath,
} from "@/lib/agent/file-attachments";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("file-attachments", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-attachments-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("extracts @path tokens from message text", () => {
    const tokens = extractAttachmentTokens(
      "Please review @contents/series/course/lesson/contents.md and improve it.",
    );
    expect(tokens).toEqual(["contents/series/course/lesson/contents.md"]);
  });

  it("rejects path traversal", () => {
    expect(isAllowedContentMdPath("contents/../secret/contents.md")).toBe(false);
    const resolved = resolveAllowedContentPath(tmpDir, "contents/../secret/contents.md");
    expect(resolved).toEqual({ error: "許可されていないパスです: contents/../secret/contents.md" });
  });

  it("rejects paths outside contents/", () => {
    expect(isAllowedContentMdPath(".claude/skills/create-draft/SKILL.md")).toBe(false);
    const resolved = resolveAllowedContentPath(
      tmpDir,
      ".claude/skills/create-draft/SKILL.md",
    );
    expect(resolved.error).toContain("許可されていないパス");
  });

  it("reads allowed markdown files", () => {
    const relative = "contents/series/course/lesson/contents.md";
    writeFile(path.join(tmpDir, relative), "# Lesson");
    const result = readAttachmentContents(tmpDir, relative);
    expect(result).toEqual({ path: relative, content: "# Lesson" });
  });

  it("lists all contents.md files under contents/", () => {
    writeFile(path.join(tmpDir, "contents/b/second", LESSON_CONTENTS_FILENAME), "# B");
    writeFile(path.join(tmpDir, "contents/a/first", LESSON_CONTENTS_FILENAME), "# A");
    const files = listContentMarkdownFiles(tmpDir);
    expect(files.map((file) => file.path)).toEqual([
      "contents/a/first/contents.md",
      "contents/b/second/contents.md",
    ]);
    expect(files.map((file) => file.name)).toEqual(["first", "second"]);
  });

  it("puts current lesson first and keeps path order for the rest", () => {
    const files = [
      { path: "contents/a/one/contents.md", name: "one" },
      { path: "contents/b/two/contents.md", name: "two" },
      { path: "contents/c/three/contents.md", name: "three" },
    ];
    expect(orderContentFilesForPicker(files, "contents/b/two/contents.md")).toEqual([
      { path: "contents/b/two/contents.md", name: "two" },
      { path: "contents/a/one/contents.md", name: "one" },
      { path: "contents/c/three/contents.md", name: "three" },
    ]);
  });
});
