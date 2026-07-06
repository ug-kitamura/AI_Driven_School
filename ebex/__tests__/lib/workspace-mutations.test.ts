import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createFile,
  createFolder,
  deleteFile,
  deleteFolder,
  readFileContent,
  renameFile,
  renameFolder,
  saveFile,
} from "@/lib/workspace-mutations";
import { loadWorkspace } from "@/lib/workspace-loader";
import { validateFolderId, validateFileName } from "@/lib/workspace-paths";

describe("workspace-paths", () => {
  it("rejects path traversal in folderId", () => {
    expect(validateFolderId("../evil")).not.toBeNull();
    expect(validateFolderId("foo/bar")).not.toBeNull();
  });

  it("rejects session.json as file name", () => {
    expect(validateFileName("session.json")).not.toBeNull();
  });
});

describe("workspace mutations", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates folder and file, loads workspace", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    expect(createFolder(tmpDir, "demo")).toEqual({ ok: true });
    expect(createFile(tmpDir, "demo", "notes.md", "# hello")).toEqual({
      ok: true,
    });

    const loaded = loadWorkspace(tmpDir);
    expect(loaded.folders).toHaveLength(1);
    expect(loaded.folders[0]?.id).toBe("demo");
    expect(loaded.folders[0]?.files).toContain("notes.md");
    expect(loaded.folders[0]?.files).not.toContain("session.json");
  });

  it("renames folder and file", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "old");
    createFile(tmpDir, "old", "a.md", "x");
    expect(renameFolder(tmpDir, "old", "new")).toEqual({ ok: true, newId: "new" });
    expect(renameFile(tmpDir, "new", "a.md", "b.md")).toEqual({
      ok: true,
      newName: "b.md",
    });
  });

  it("deletes empty folder and file", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "tmp");
    createFile(tmpDir, "tmp", "x.md", "");
    expect(deleteFile(tmpDir, "tmp", "x.md")).toEqual({ ok: true });
    expect(deleteFolder(tmpDir, "tmp")).toEqual({ ok: true });
  });

  it("saves and reads file content", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "proj");
    createFile(tmpDir, "proj", "doc.md", "v1");
    saveFile(tmpDir, "proj", "doc.md", "v2");
    expect(readFileContent(tmpDir, "proj", "doc.md")).toEqual({ content: "v2" });
  });
});
