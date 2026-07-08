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
import { createFile, createFolder, createSubFolder } from "@/lib/workspace-mutations";

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
});
