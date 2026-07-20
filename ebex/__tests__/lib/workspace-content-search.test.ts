import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { searchWorkspaceContent } from "@/lib/workspace-content-search";
import {
  createFile,
  createFolder,
  createSubFolder,
} from "@/lib/workspace-mutations";
import { getWorkspaceDir } from "@/lib/workspace-paths";

describe("workspace-content-search", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns empty matches for blank query", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-search-"));
    expect(searchWorkspaceContent(tmpDir, "")).toEqual({
      matches: [],
      truncated: false,
    });
  });

  it("finds text in markdown files", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-search-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "TODO: finish this");
    const result = searchWorkspaceContent(tmpDir, "TODO");
    expect(result.matches).toEqual([
      { folderPath: "demo", fileName: "notes.md" },
    ]);
    expect(result.truncated).toBe(false);
  });

  it("is case insensitive", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-search-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "Meeting notes");
    const result = searchWorkspaceContent(tmpDir, "meeting");
    expect(result.matches).toEqual([
      { folderPath: "demo", fileName: "notes.md" },
    ]);
  });

  it("skips node_modules directory", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-search-"));
    const workspaceDir = getWorkspaceDir(tmpDir);
    fs.mkdirSync(path.join(workspaceDir, "node_modules", "pkg"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(workspaceDir, "node_modules", "pkg", "readme.md"),
      "SECRET_KEYWORD",
      "utf-8",
    );
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "visible.md", "visible");
    const result = searchWorkspaceContent(tmpDir, "SECRET_KEYWORD");
    expect(result.matches).toEqual([]);
  });

  it("searches nested folders", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-search-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    createFile(tmpDir, "demo/sub", "deep.md", "nested keyword");
    const result = searchWorkspaceContent(tmpDir, "nested");
    expect(result.matches).toEqual([
      { folderPath: "demo/sub", fileName: "deep.md" },
    ]);
  });
});
