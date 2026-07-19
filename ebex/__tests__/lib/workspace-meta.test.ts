import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  decideRegistryResolution,
  ensureWorkspaceMeta,
  getMetaFavoritesPath,
  getMetaJsonPath,
  getMetaSessionPath,
  readMetaRegistry,
  readStoredFavorites,
  resolveProjectIno,
  statFolderIno,
  syncMetaRegistry,
  writeMetaRegistry,
  type MetaEntry,
} from "@/lib/workspace-meta";
import { FAVORITES_FILENAME } from "@/lib/workspace-favorites";
import { createInitialStorage } from "@/lib/agent-chat-storage";
import { createFolder } from "@/lib/workspace-mutations";
import { SESSION_FILENAME, getWorkspaceDir } from "@/lib/workspace-paths";

function makeTmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ebex-meta-"));
}

describe("workspace-meta", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("decideRegistryResolution (テーブル駆動)", () => {
    const entries: MetaEntry[] = [
      { ino: "100", folderPath: "alpha", createdAt: "2026-01-01T00:00:00Z" },
      { ino: "200", folderPath: "beta", createdAt: "2026-01-02T00:00:00Z" },
    ];

    const cases: Array<{
      name: string;
      ino: string;
      folderPath: string;
      expected: { kind: string; folderPathChanged?: boolean; oldIno?: string };
    }> = [
      {
        name: "ino一致・パス一致 → match（更新不要）",
        ino: "100",
        folderPath: "alpha",
        expected: { kind: "match", folderPathChanged: false },
      },
      {
        name: "ino一致・パス不一致 → match（外部リネーム追従）",
        ino: "100",
        folderPath: "alpha-renamed",
        expected: { kind: "match", folderPathChanged: true },
      },
      {
        name: "ino不一致・パス一致 → relink（コピー/復元で ino 変化）",
        ino: "999",
        folderPath: "beta",
        expected: { kind: "relink", oldIno: "200" },
      },
      {
        name: "ino不一致・パス不一致 → new",
        ino: "999",
        folderPath: "gamma",
        expected: { kind: "new" },
      },
      {
        name: "bigint 境界値（2^53 超の ino 文字列も厳密一致）",
        ino: "9007199254740993",
        folderPath: "gamma",
        expected: { kind: "new" },
      },
    ];

    for (const c of cases) {
      it(c.name, () => {
        const result = decideRegistryResolution(entries, c.ino, c.folderPath);
        expect(result.kind).toBe(c.expected.kind);
        if (result.kind === "match") {
          expect(result.folderPathChanged).toBe(c.expected.folderPathChanged);
        }
        if (result.kind === "relink") {
          expect(result.oldIno).toBe(c.expected.oldIno);
        }
      });
    }
  });

  it("statFolderIno returns a decimal string for a directory", () => {
    tmpDir = makeTmpRoot();
    const ino = statFolderIno(tmpDir);
    expect(ino).toMatch(/^\d+$/);
  });

  it("resolveProjectIno registers a new folder into the registry", () => {
    tmpDir = makeTmpRoot();
    createFolder(tmpDir, "demo");
    const resolved = resolveProjectIno(tmpDir, "demo");
    expect(resolved).not.toHaveProperty("error");
    const entries = readMetaRegistry(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].folderPath).toBe("demo");
  });

  it("resolveProjectIno follows external rename via ino (self-heal)", () => {
    tmpDir = makeTmpRoot();
    createFolder(tmpDir, "demo");
    const before = resolveProjectIno(tmpDir, "demo");
    if ("error" in before) throw new Error(before.error);

    // Explorer 相当の外部リネーム
    const workspaceDir = getWorkspaceDir(tmpDir);
    fs.renameSync(
      path.join(workspaceDir, "demo"),
      path.join(workspaceDir, "demo-ext"),
    );

    const after = resolveProjectIno(tmpDir, "demo-ext");
    if ("error" in after) throw new Error(after.error);
    expect(after.ino).toBe(before.ino);
    expect(readMetaRegistry(tmpDir)).toEqual([
      expect.objectContaining({ ino: before.ino, folderPath: "demo-ext" }),
    ]);
  });

  it("relinks session file when ino changes but path matches", () => {
    tmpDir = makeTmpRoot();
    createFolder(tmpDir, "demo");
    // 旧 ino のレコードとセッションファイルを偽装（コピー/復元後の状態）
    writeMetaRegistry(tmpDir, [
      { ino: "12345", folderPath: "demo", createdAt: "2026-01-01T00:00:00Z" },
    ]);
    const oldSession = getMetaSessionPath(tmpDir, "12345");
    fs.mkdirSync(path.dirname(oldSession), { recursive: true });
    fs.writeFileSync(oldSession, JSON.stringify(createInitialStorage()));

    const resolved = resolveProjectIno(tmpDir, "demo");
    if ("error" in resolved) throw new Error(resolved.error);
    expect(resolved.ino).not.toBe("12345");
    expect(fs.existsSync(oldSession)).toBe(false);
    expect(fs.existsSync(getMetaSessionPath(tmpDir, resolved.ino))).toBe(true);
    expect(readMetaRegistry(tmpDir)[0].ino).toBe(resolved.ino);
  });

  it("syncMetaRegistry rebuilds registry and drops orphans", () => {
    tmpDir = makeTmpRoot();
    createFolder(tmpDir, "alive");
    writeMetaRegistry(tmpDir, [
      { ino: "424242", folderPath: "ghost", createdAt: "2026-01-01T00:00:00Z" },
    ]);
    const orphanSession = getMetaSessionPath(tmpDir, "424242");
    fs.mkdirSync(path.dirname(orphanSession), { recursive: true });
    fs.writeFileSync(orphanSession, "{}");

    const entries = syncMetaRegistry(tmpDir);
    expect(entries.map((e) => e.folderPath)).toEqual(["alive"]);
    expect(fs.existsSync(orphanSession)).toBe(false);
  });

  it("ensureWorkspaceMeta migrates legacy session.json and favorites (idempotent)", () => {
    tmpDir = makeTmpRoot();
    createFolder(tmpDir, "demo");
    createFolder(tmpDir, "other");
    const workspaceDir = getWorkspaceDir(tmpDir);
    const storage = createInitialStorage();
    fs.writeFileSync(
      path.join(workspaceDir, "demo", SESSION_FILENAME),
      JSON.stringify(storage),
    );
    fs.writeFileSync(
      path.join(tmpDir, FAVORITES_FILENAME),
      JSON.stringify({
        favorites: [
          { folderPath: "demo", fileName: "notes.md" },
          { folderPath: "demo/sub", fileName: "deep.md" },
          { folderPath: "missing", fileName: "gone.md" },
        ],
      }),
    );

    ensureWorkspaceMeta(tmpDir);

    // 台帳が構築され、meta.json が完了マーカーとして存在する
    expect(fs.existsSync(getMetaJsonPath(tmpDir))).toBe(true);
    const entries = readMetaRegistry(tmpDir);
    expect(entries.map((e) => e.folderPath).sort()).toEqual(["demo", "other"]);

    // セッションが移設され、元ファイルは削除される
    const demoIno = entries.find((e) => e.folderPath === "demo")!.ino;
    expect(fs.existsSync(getMetaSessionPath(tmpDir, demoIno))).toBe(true);
    expect(
      fs.existsSync(path.join(workspaceDir, "demo", SESSION_FILENAME)),
    ).toBe(false);

    // お気に入りが ino キーへ変換され、実在しないフォルダ分は捨てられる
    const stored = readStoredFavorites(tmpDir);
    expect(stored).toEqual([
      { ino: demoIno, fileName: "notes.md" },
      { ino: demoIno, fileName: "sub/deep.md" },
    ]);
    expect(fs.existsSync(path.join(tmpDir, FAVORITES_FILENAME))).toBe(false);
    expect(fs.existsSync(getMetaFavoritesPath(tmpDir))).toBe(true);

    // 再実行しても安全（冪等）
    ensureWorkspaceMeta(tmpDir);
    expect(readMetaRegistry(tmpDir)).toHaveLength(2);
    expect(readStoredFavorites(tmpDir)).toHaveLength(2);
  });

  it("keeps corrupt legacy session.json without migrating (no data loss)", () => {
    tmpDir = makeTmpRoot();
    createFolder(tmpDir, "demo");
    const legacyPath = path.join(
      getWorkspaceDir(tmpDir),
      "demo",
      SESSION_FILENAME,
    );
    fs.writeFileSync(legacyPath, "{ broken json");

    ensureWorkspaceMeta(tmpDir);

    expect(fs.existsSync(legacyPath)).toBe(true);
    expect(fs.existsSync(getMetaJsonPath(tmpDir))).toBe(true);
  });
});
