import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  loadLastFileSelection,
  saveLastFileSelection,
} from "@/lib/workspace-file-selection";

describe("workspace-file-selection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("ファイル選択を保存して復元できる", () => {
    saveLastFileSelection({ folderPath: "demo/sub", fileName: "notes.md" });

    expect(loadLastFileSelection()).toEqual({
      folderPath: "demo/sub",
      fileName: "notes.md",
    });
  });

  it("folderId キーの旧形式も読める", () => {
    localStorage.setItem(
      STORAGE_KEYS.lastFile,
      JSON.stringify({ folderId: "demo", fileName: "notes.md" }),
    );

    expect(loadLastFileSelection()).toEqual({
      folderPath: "demo",
      fileName: "notes.md",
    });
  });

  it("撤回済みフォルダ選択形式（kind: folder）は復元しない", () => {
    localStorage.setItem(
      STORAGE_KEYS.lastFile,
      JSON.stringify({ kind: "folder", folderPath: "demo/hoge" }),
    );

    expect(loadLastFileSelection()).toBeNull();
  });

  it("kind: file 付きで保存されたデータも読める", () => {
    localStorage.setItem(
      STORAGE_KEYS.lastFile,
      JSON.stringify({ kind: "file", folderPath: "demo", fileName: "a.md" }),
    );

    expect(loadLastFileSelection()).toEqual({
      folderPath: "demo",
      fileName: "a.md",
    });
  });

  it("fileName の無いデータは復元しない", () => {
    localStorage.setItem(
      STORAGE_KEYS.lastFile,
      JSON.stringify({ folderPath: "demo" }),
    );

    expect(loadLastFileSelection()).toBeNull();
  });

  it("壊れた JSON は null を返す", () => {
    localStorage.setItem(STORAGE_KEYS.lastFile, "{broken");

    expect(loadLastFileSelection()).toBeNull();
  });
});
