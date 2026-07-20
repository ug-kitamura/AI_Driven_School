import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isAllowedWorkspacePath,
  listWorkspaceFolderFiles,
  orderWorkspaceFilesForPicker,
  resolveAttachmentsForMessage,
} from "@/lib/agent/workspace-file-attachments";
import {
  createFile,
  createFolder,
  createSubFolder,
} from "@/lib/workspace-mutations";

describe("workspace-file-attachments", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("allows nested workspace paths", () => {
    expect(isAllowedWorkspacePath("workspace/demo/sub/notes.md")).toBe(true);
    expect(isAllowedWorkspacePath("workspace/demo")).toBe(false);
  });

  it("lists nested files recursively", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-agent-files-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    createFile(tmpDir, "demo/sub", "notes.md", "hello");

    const files = listWorkspaceFolderFiles(tmpDir, "demo");
    expect(files).toHaveLength(1);
    expect(files[0]?.relativePath).toBe("sub/notes.md");
    expect(files[0]?.path).toBe("workspace/demo/sub/notes.md");
  });

  it("orders current nested file first", () => {
    const files = orderWorkspaceFilesForPicker(
      [
        {
          name: "a.md",
          relativePath: "a.md",
          path: "workspace/demo/a.md",
        },
        {
          name: "notes.md",
          relativePath: "sub/notes.md",
          path: "workspace/demo/sub/notes.md",
        },
      ],
      "sub/notes.md",
    );
    expect(files[0]?.relativePath).toBe("sub/notes.md");
  });

  it("resolves nested attachment paths on invoke", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-agent-attach-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    createFile(tmpDir, "demo/sub", "notes.md", "nested content");

    const result = resolveAttachmentsForMessage(
      tmpDir,
      "please read @workspace/demo/sub/notes.md",
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.attachments[0]?.content).toBe("nested content");
  });

  it("prefers structured attachment paths over message tokens", () => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ebex-agent-attach-struct-"),
    );
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    createFile(tmpDir, "demo/sub", "notes.md", "structured content");
    createFile(tmpDir, "demo", "other.md", "other content");

    const result = resolveAttachmentsForMessage(
      tmpDir,
      "notes.md を要約して @workspace/demo/other.md",
      ["workspace/demo/sub/notes.md"],
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]?.path).toBe("workspace/demo/sub/notes.md");
    expect(result.attachments[0]?.content).toBe("structured content");
  });

  it("falls back to message tokens when structured paths are empty", () => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "ebex-agent-attach-fallback-"),
    );
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "fallback content");

    const result = resolveAttachmentsForMessage(
      tmpDir,
      "read @workspace/demo/notes.md",
      [],
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.attachments[0]?.content).toBe("fallback content");
  });

  it("rejects disallowed structured attachment paths", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-agent-attach-deny-"));
    const result = resolveAttachmentsForMessage(tmpDir, "notes.md", [
      "../secrets.txt",
    ]);
    expect("error" in result).toBe(true);
  });
});
