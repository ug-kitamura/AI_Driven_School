import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { favoriteKey } from "@/lib/workspace-favorites";
import {
  readFavorites,
  remapFavoritesOnFolderRename,
  removeFavoriteFile,
  removeFavoritesUnderPath,
  renameFavoriteFile,
  toggleFavorite,
} from "@/lib/workspace-favorites-io";
import { readStoredFavorites } from "@/lib/workspace-meta";
import {
  createFile,
  createFolder,
  createSubFolder,
  deleteFolder,
  renameFolder,
} from "@/lib/workspace-mutations";
import { getWorkspaceDir } from "@/lib/workspace-paths";

describe("workspace-favorites", () => {
  let tmpDir: string;

  function makeTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fav-"));
  }

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("reads empty favorites when file is missing", () => {
    tmpDir = makeTmp();
    expect(readFavorites(tmpDir)).toEqual([]);
  });

  it("toggles favorite on and off (stored by ino)", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    expect(toggleFavorite(tmpDir, "demo", "notes.md")).toEqual([
      { folderPath: "demo", fileName: "notes.md" },
    ]);
    expect(readStoredFavorites(tmpDir)[0].ino).toMatch(/^\d+$/);
    expect(toggleFavorite(tmpDir, "demo", "notes.md")).toEqual([]);
  });

  it("stores subfolder favorites as project-relative paths", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    toggleFavorite(tmpDir, "demo/sub", "notes.md");
    expect(readStoredFavorites(tmpDir)[0].fileName).toBe("sub/notes.md");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo/sub", fileName: "notes.md" },
    ]);
  });

  it("keeps favorites across project folder rename without remap", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    toggleFavorite(tmpDir, "demo", "root.md");
    toggleFavorite(tmpDir, "demo/sub", "notes.md");

    const result = renameFolder(tmpDir, "demo", "demo-renamed");
    expect(result).toHaveProperty("ok", true);

    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo-renamed", fileName: "root.md" },
      { folderPath: "demo-renamed/sub", fileName: "notes.md" },
    ]);
  });

  it("keeps favorites across external (Explorer) rename via ino", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    toggleFavorite(tmpDir, "demo", "notes.md");

    const workspaceDir = getWorkspaceDir(tmpDir);
    fs.renameSync(
      path.join(workspaceDir, "demo"),
      path.join(workspaceDir, "demo-ext"),
    );

    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo-ext", fileName: "notes.md" },
    ]);
  });

  it("remaps subfolder favorites on subfolder rename", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    toggleFavorite(tmpDir, "demo/sub", "notes.md");

    remapFavoritesOnFolderRename(tmpDir, "demo/sub", "demo/sub2");
    expect(readStoredFavorites(tmpDir)[0].fileName).toBe("sub2/notes.md");
  });

  it("renames favorite file entry", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    toggleFavorite(tmpDir, "demo", "notes.md");
    renameFavoriteFile(tmpDir, "demo", "notes.md", "renamed.md");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo", fileName: "renamed.md" },
    ]);
  });

  it("removes a single favorite file", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    toggleFavorite(tmpDir, "demo", "notes.md");
    toggleFavorite(tmpDir, "demo", "other.md");
    removeFavoriteFile(tmpDir, "demo", "notes.md");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo", fileName: "other.md" },
    ]);
  });

  it("removes favorites when the project folder is deleted", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    createFolder(tmpDir, "other");
    toggleFavorite(tmpDir, "demo", "root.md");
    toggleFavorite(tmpDir, "other", "keep.md");

    const result = deleteFolder(tmpDir, "demo");
    expect(result).toHaveProperty("ok", true);

    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "other", fileName: "keep.md" },
    ]);
    expect(readStoredFavorites(tmpDir)).toHaveLength(1);
  });

  it("removes favorites under a deleted subfolder", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    toggleFavorite(tmpDir, "demo", "root.md");
    toggleFavorite(tmpDir, "demo/sub", "notes.md");

    removeFavoritesUnderPath(tmpDir, "demo/sub");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo", fileName: "root.md" },
    ]);
  });

  it("builds stable favorite keys", () => {
    expect(favoriteKey({ folderPath: "demo/sub", fileName: "notes.md" })).toBe(
      "demo/sub/notes.md",
    );
  });

  it("updates favorites when mutations rename or delete files", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "hello");
    toggleFavorite(tmpDir, "demo", "notes.md");
    renameFavoriteFile(tmpDir, "demo", "notes.md", "renamed.md");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo", fileName: "renamed.md" },
    ]);
  });
});
