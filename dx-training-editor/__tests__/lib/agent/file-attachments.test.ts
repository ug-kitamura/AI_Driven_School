import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  extractAttachmentTokens,
  isAllowedContentMdPath,
  readAttachmentContents,
  resolveAllowedContentPath,
} from "@/lib/agent/file-attachments";

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
      "Please review @contents/series/course/lesson.md and improve it.",
    );
    expect(tokens).toEqual(["contents/series/course/lesson.md"]);
  });

  it("rejects path traversal", () => {
    expect(isAllowedContentMdPath("contents/../secret.md")).toBe(false);
    const resolved = resolveAllowedContentPath(tmpDir, "contents/../secret.md");
    expect(resolved).toEqual({ error: "許可されていないパスです: contents/../secret.md" });
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
    const relative = "contents/series/course/lesson.md";
    writeFile(path.join(tmpDir, relative), "# Lesson");
    const result = readAttachmentContents(tmpDir, relative);
    expect(result).toEqual({ path: relative, content: "# Lesson" });
  });
});
