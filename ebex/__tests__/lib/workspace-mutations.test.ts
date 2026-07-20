import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  copyFolder,
  createFile,
  createFolder,
  createSubFolder,
  deleteFile,
  deleteFolder,
  moveFile,
  readFileContent,
  renameFile,
  renameFolder,
  saveFile,
} from "@/lib/workspace-mutations";
import { getWorkspaceFingerprint, loadWorkspace } from "@/lib/workspace-loader";
import {
  SESSION_FILENAME,
  getWorkspaceDir,
  isFolderEmpty,
  validateFileName,
  validateRelativeFolderPath,
} from "@/lib/workspace-paths";

describe("workspace-paths", () => {
  it("rejects path traversal in folder paths", () => {
    expect(validateRelativeFolderPath("../evil")).not.toBeNull();
    expect(validateRelativeFolderPath("foo/bar")).toBeNull();
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
      fileName: "notes.md",
    });

    const loaded = loadWorkspace(tmpDir);
    expect(loaded.folders).toHaveLength(1);
    expect(loaded.folders[0]?.path).toBe("demo");
    expect(loaded.folders[0]?.files).toContain("notes.md");
    expect(loaded.folders[0]?.files).not.toContain("session.json");
  });

  it("creates nested subfolder and file", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "demo");
    expect(createSubFolder(tmpDir, "demo", "sub")).toEqual({
      ok: true,
      path: "demo/sub",
    });
    expect(createFile(tmpDir, "demo/sub", "notes.md", "nested")).toEqual({
      ok: true,
      fileName: "notes.md",
    });

    const loaded = loadWorkspace(tmpDir);
    expect(loaded.folders[0]?.children[0]?.files).toContain("notes.md");
  });

  it("renames folder and file", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "old");
    createFile(tmpDir, "old", "a.md", "x");
    expect(renameFolder(tmpDir, "old", "new")).toEqual({
      ok: true,
      newPath: "new",
    });
    expect(renameFile(tmpDir, "new", "a.md", "b.md")).toEqual({
      ok: true,
      newName: "b.md",
    });
  });

  it("renames nested folder", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    expect(renameFolder(tmpDir, "demo/sub", "demo/sub-renamed")).toEqual({
      ok: true,
      newPath: "demo/sub-renamed",
    });
  });

  it("deletes empty folder and file", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "tmp");
    createFile(tmpDir, "tmp", "x.md", "");
    expect(deleteFile(tmpDir, "tmp", "x.md")).toEqual({ ok: true });
    expect(deleteFolder(tmpDir, "tmp")).toEqual({ ok: true });
  });

  it("treats a folder containing only session.json as empty and deletes it", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "tmp");
    fs.writeFileSync(
      path.join(getWorkspaceDir(tmpDir), "tmp", SESSION_FILENAME),
      "{}",
    );

    expect(isFolderEmpty(tmpDir, "tmp")).toBe(true);
    expect(deleteFolder(tmpDir, "tmp")).toEqual({ ok: true });
    expect(fs.existsSync(path.join(getWorkspaceDir(tmpDir), "tmp"))).toBe(
      false,
    );
  });

  it("keeps blocking deletion when a folder has files other than session.json", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "tmp");
    createFile(tmpDir, "tmp", "notes.md", "");
    fs.writeFileSync(
      path.join(getWorkspaceDir(tmpDir), "tmp", SESSION_FILENAME),
      "{}",
    );

    expect(isFolderEmpty(tmpDir, "tmp")).toBe(false);
    expect(deleteFolder(tmpDir, "tmp")).toEqual({
      error: "空のフォルダのみ削除できます",
    });
  });

  it("changes fingerprint when a folder is renamed without touching file mtimes", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "before");
    createFile(tmpDir, "before", "notes.md", "hello");

    const beforeFingerprint = getWorkspaceFingerprint(tmpDir);
    renameFolder(tmpDir, "before", "after");
    const afterFingerprint = getWorkspaceFingerprint(tmpDir);

    expect(afterFingerprint).not.toBe(beforeFingerprint);
  });

  it("changes fingerprint when an empty folder is created or deleted", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    const initialFingerprint = getWorkspaceFingerprint(tmpDir);

    createFolder(tmpDir, "new-empty");
    const afterCreateFingerprint = getWorkspaceFingerprint(tmpDir);
    expect(afterCreateFingerprint).not.toBe(initialFingerprint);

    deleteFolder(tmpDir, "new-empty");
    const afterDeleteFingerprint = getWorkspaceFingerprint(tmpDir);
    expect(afterDeleteFingerprint).not.toBe(afterCreateFingerprint);
    expect(afterDeleteFingerprint).toBe(initialFingerprint);
  });

  it("saves and reads file content", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "proj");
    createFile(tmpDir, "proj", "doc.md", "v1");
    saveFile(tmpDir, "proj", "doc.md", "v2");
    expect(readFileContent(tmpDir, "proj", "doc.md")).toEqual({
      content: "v2",
    });
  });

  it("moves file across folders", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "from");
    createSubFolder(tmpDir, "demo", "to");
    createFile(tmpDir, "demo/from", "notes.md", "hello");
    expect(moveFile(tmpDir, "demo/from", "notes.md", "demo/to")).toEqual({
      ok: true,
      newName: "notes.md",
    });
    expect(readFileContent(tmpDir, "demo/to", "notes.md")).toEqual({
      content: "hello",
    });
  });

  it("rejects move when target file exists", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "a.md", "");
    createFile(tmpDir, "demo", "b.md", "");
    expect(moveFile(tmpDir, "demo", "a.md", "demo", "b.md")).toEqual({
      error: "同名のファイルが既に存在します",
    });
  });

  it("auto-renames file on move when policy is auto-rename", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "a.md", "");
    createFile(tmpDir, "demo", "b.md", "");
    expect(
      moveFile(tmpDir, "demo", "a.md", "demo", "b.md", "auto-rename"),
    ).toEqual({ ok: true, newName: "b-2.md" });
  });

  it("auto-renames file on paste-like create", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "test.md", "v1");
    expect(createFile(tmpDir, "demo", "test.md", "v2", "auto-rename")).toEqual({
      ok: true,
      fileName: "test-2.md",
    });
    expect(readFileContent(tmpDir, "demo", "test-2.md")).toEqual({
      content: "v2",
    });
  });

  it("auto-renames folder on copy when policy is auto-rename", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "src-proj");
    createFolder(tmpDir, "dst-proj");
    createSubFolder(tmpDir, "src-proj", "sub");
    createSubFolder(tmpDir, "dst-proj", "sub");
    expect(
      copyFolder(tmpDir, "src-proj/sub", "dst-proj", undefined, "auto-rename"),
    ).toEqual({ ok: true, path: "dst-proj/sub-2" });
  });

  it("copies subfolder recursively", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "src-proj");
    createFolder(tmpDir, "dst-proj");
    createSubFolder(tmpDir, "src-proj", "sub");
    createFile(tmpDir, "src-proj/sub", "notes.md", "nested");
    expect(copyFolder(tmpDir, "src-proj/sub", "dst-proj")).toEqual({
      ok: true,
      path: "dst-proj/sub",
    });
    expect(readFileContent(tmpDir, "dst-proj/sub", "notes.md")).toEqual({
      content: "nested",
    });
  });

  it("recursively deletes subfolder with contents", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-ws-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    createFile(tmpDir, "demo/sub", "notes.md", "");
    expect(deleteFolder(tmpDir, "demo/sub")).toEqual({ ok: true });
    expect(
      fs.existsSync(path.join(getWorkspaceDir(tmpDir), "demo", "sub")),
    ).toBe(false);
  });
});
