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
  writeFavorites,
} from "@/lib/workspace-favorites-io";
import { createFile, createFolder } from "@/lib/workspace-mutations";

describe("workspace-favorites", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("reads empty favorites when file is missing", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fav-"));
    expect(readFavorites(tmpDir)).toEqual([]);
  });

  it("toggles favorite on and off", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fav-"));
    expect(toggleFavorite(tmpDir, "demo", "notes.md")).toEqual([
      { folderPath: "demo", fileName: "notes.md" },
    ]);
    expect(toggleFavorite(tmpDir, "demo", "notes.md")).toEqual([]);
  });

  it("renames favorite file entry", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fav-"));
    writeFavorites(tmpDir, [{ folderPath: "demo", fileName: "notes.md" }]);
    renameFavoriteFile(tmpDir, "demo", "notes.md", "renamed.md");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo", fileName: "renamed.md" },
    ]);
  });

  it("remaps favorites when folder is renamed", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fav-"));
    writeFavorites(tmpDir, [
      { folderPath: "demo", fileName: "root.md" },
      { folderPath: "demo/sub", fileName: "notes.md" },
    ]);
    remapFavoritesOnFolderRename(tmpDir, "demo", "demo-renamed");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo-renamed", fileName: "root.md" },
      { folderPath: "demo-renamed/sub", fileName: "notes.md" },
    ]);
  });

  it("removes favorites under deleted folder path", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fav-"));
    writeFavorites(tmpDir, [
      { folderPath: "demo", fileName: "root.md" },
      { folderPath: "demo/sub", fileName: "notes.md" },
      { folderPath: "other", fileName: "keep.md" },
    ]);
    removeFavoritesUnderPath(tmpDir, "demo");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "other", fileName: "keep.md" },
    ]);
  });

  it("removes a single favorite file", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fav-"));
    writeFavorites(tmpDir, [
      { folderPath: "demo", fileName: "notes.md" },
      { folderPath: "demo", fileName: "other.md" },
    ]);
    removeFavoriteFile(tmpDir, "demo", "notes.md");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo", fileName: "other.md" },
    ]);
  });

  it("builds stable favorite keys", () => {
    expect(favoriteKey({ folderPath: "demo/sub", fileName: "notes.md" })).toBe(
      "demo/sub/notes.md",
    );
  });

  it("updates favorites when mutations rename or delete files", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fav-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "hello");
    toggleFavorite(tmpDir, "demo", "notes.md");
    renameFavoriteFile(tmpDir, "demo", "notes.md", "renamed.md");
    expect(readFavorites(tmpDir)).toEqual([
      { folderPath: "demo", fileName: "renamed.md" },
    ]);
  });
});
