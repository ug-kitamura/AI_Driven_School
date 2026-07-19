import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readFolderSessionFile,
  writeFolderSessionFile,
} from "@/lib/agent-session-store";
import { createInitialStorage } from "@/lib/agent-chat-storage";
import { createFolder, renameFolder } from "@/lib/workspace-mutations";
import { getMetaSessionPath, resolveProjectIno } from "@/lib/workspace-meta";
import { SESSION_FILENAME, getWorkspaceDir } from "@/lib/workspace-paths";

describe("agent-session-store", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("writes and reads session under .meta/sessions/<ino>.json", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-session-"));
    createFolder(tmpDir, "demo");
    const storage = createInitialStorage();
    writeFolderSessionFile(tmpDir, "demo", storage);

    const loaded = readFolderSessionFile(tmpDir, "demo");
    expect(loaded?.activeSessionId).toBe(storage.activeSessionId);

    // プロジェクトフォルダ内にはファイルが作られない
    const folderDir = path.join(getWorkspaceDir(tmpDir), "demo");
    expect(fs.readdirSync(folderDir)).toEqual([]);

    // 実体は .meta/sessions/<ino>.json
    const resolved = resolveProjectIno(tmpDir, "demo");
    if ("error" in resolved) throw new Error(resolved.error);
    expect(fs.existsSync(getMetaSessionPath(tmpDir, resolved.ino))).toBe(true);
  });

  it("keeps session across folder rename (ino is stable)", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-session-"));
    createFolder(tmpDir, "demo");
    const storage = createInitialStorage();
    writeFolderSessionFile(tmpDir, "demo", storage);

    const renamed = renameFolder(tmpDir, "demo", "demo-renamed");
    expect(renamed).toHaveProperty("ok", true);

    const loaded = readFolderSessionFile(tmpDir, "demo-renamed");
    expect(loaded?.activeSessionId).toBe(storage.activeSessionId);
  });

  it("falls back to legacy in-folder session.json for unmigrated data", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-session-"));
    createFolder(tmpDir, "demo");
    const storage = createInitialStorage();
    fs.writeFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", SESSION_FILENAME),
      JSON.stringify(storage),
    );

    const loaded = readFolderSessionFile(tmpDir, "demo");
    expect(loaded?.activeSessionId).toBe(storage.activeSessionId);
  });

  it("returns null for a missing folder", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-session-"));
    expect(readFolderSessionFile(tmpDir, "nope")).toBeNull();
  });

  it("throws Folder not found when writing to a missing folder", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-session-"));
    expect(() =>
      writeFolderSessionFile(tmpDir, "nope", createInitialStorage()),
    ).toThrow(/Folder not found/);
  });
});
