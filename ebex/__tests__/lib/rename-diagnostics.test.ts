import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendDiagnosticsRecord,
  collectLockedEntries,
  diagnoseRenameFailure,
  errorCodeOf,
  runControlRenameTest,
  type RenameDiagnosticsRecord,
} from "@/lib/rename-diagnostics";
import { getDiagnosticsLogPath } from "@/lib/workspace-meta";
import { createFolder, renameFolder } from "@/lib/workspace-mutations";
import { getWorkspaceDir } from "@/lib/workspace-paths";

describe("rename-diagnostics", () => {
  let tmpDir: string;

  function makeTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "ebex-diag-"));
  }

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("extracts error codes from ErrnoException-like values", () => {
    const err = Object.assign(new Error("boom"), { code: "EPERM" });
    expect(errorCodeOf(err)).toBe("EPERM");
    expect(errorCodeOf(new Error("no code"))).toBe("UNKNOWN");
    expect(errorCodeOf(null)).toBe("UNKNOWN");
  });

  it("appends JSON Lines records to .meta/diagnostics.log", () => {
    tmpDir = makeTmp();
    appendDiagnosticsRecord(tmpDir, { type: "test", value: 1 });
    appendDiagnosticsRecord(tmpDir, { type: "test", value: 2 });
    const lines = fs
      .readFileSync(getDiagnosticsLogPath(tmpDir), "utf-8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ type: "test", value: 1 });
  });

  it("reports no locked entries for an unlocked folder", () => {
    tmpDir = makeTmp();
    const dir = path.join(tmpDir, "target");
    fs.mkdirSync(path.join(dir, "sub"), { recursive: true });
    fs.writeFileSync(path.join(dir, "a.txt"), "a");
    fs.writeFileSync(path.join(dir, "sub", "b.txt"), "b");

    const result = collectLockedEntries(dir);
    expect(result.lockedEntries).toEqual([]);
    expect(result.probeTruncated).toBe(false);
    // プローブ後に元の構造が保たれている
    expect(fs.existsSync(path.join(dir, "a.txt"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "sub", "b.txt"))).toBe(true);
  });

  it("identifies the locked entry via injected rename failure", () => {
    tmpDir = makeTmp();
    const dir = path.join(tmpDir, "target");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "free.txt"), "ok");
    fs.writeFileSync(path.join(dir, "locked.txt"), "no");

    const lockedAbs = path.join(dir, "locked.txt");
    const result = collectLockedEntries(dir, (from, to) => {
      if (from === lockedAbs) {
        throw Object.assign(new Error("busy"), { code: "EPERM" });
      }
      fs.renameSync(from, to);
    });

    expect(result.lockedEntries).toEqual([
      { path: "locked.txt", code: "EPERM" },
    ]);
  });

  it("runs the control rename test in a writable directory", () => {
    tmpDir = makeTmp();
    const result = runControlRenameTest(tmpDir);
    expect(result.ok).toBe(true);
    // 一時フォルダが残っていない
    expect(
      fs.readdirSync(tmpDir).filter((n) => n.includes("__ebex-diag")),
    ).toEqual([]);
  });

  it("writes a full diagnostics record on rename failure", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    const workspaceDir = getWorkspaceDir(tmpDir);
    const record = diagnoseRenameFailure(tmpDir, {
      fromPath: "demo",
      toPath: "demo-next",
      fromAbsolutePath: path.join(workspaceDir, "demo"),
      toAbsolutePath: path.join(workspaceDir, "demo-next"),
      error: Object.assign(new Error("busy"), { code: "EPERM" }),
    });

    expect(record.code).toBe("EPERM");
    expect(record.targetExists).toBe(false);
    expect(record.controlTest.ok).toBe(true);

    const lines = fs
      .readFileSync(getDiagnosticsLogPath(tmpDir), "utf-8")
      .trim()
      .split("\n");
    const logged = JSON.parse(lines[0]) as RenameDiagnosticsRecord;
    expect(logged.type).toBe("rename");
    expect(logged.fromPath).toBe("demo");
    expect(logged.fromPathLength).toBeGreaterThan(0);
    expect(Array.isArray(logged.lockedEntries)).toBe(true);
  });

  it("renameFolder returns a diagnostics-aware error and logs a record on EPERM", () => {
    tmpDir = makeTmp();
    createFolder(tmpDir, "demo");
    const workspaceDir = getWorkspaceDir(tmpDir);
    const demoDir = path.join(workspaceDir, "demo");
    fs.writeFileSync(path.join(demoDir, "keep.txt"), "k");

    // 対象フォルダ本体の rename だけを EPERM で失敗させ、
    // 診断内部のプローブ・対照テストは実 rename を使う
    const realRename = fs.renameSync.bind(fs);
    const spy = vi
      .spyOn(fs, "renameSync")
      .mockImplementation((from: fs.PathLike, to: fs.PathLike) => {
        if (String(from) === demoDir) {
          throw Object.assign(new Error("operation not permitted"), {
            code: "EPERM",
          });
        }
        realRename(from, to);
      });

    try {
      const result = renameFolder(tmpDir, "demo", "demo-next");
      expect(result).toHaveProperty("error");
      const message = String((result as { error: string }).error);
      expect(message).toContain("EPERM");
      expect(message).toContain("diagnostics.log");

      const lines = fs
        .readFileSync(getDiagnosticsLogPath(tmpDir), "utf-8")
        .trim()
        .split("\n");
      const logged = JSON.parse(lines[0]) as RenameDiagnosticsRecord;
      expect(logged.type).toBe("rename");
      expect(logged.code).toBe("EPERM");
      expect(logged.toPath).toBe("demo-next");
    } finally {
      spy.mockRestore();
    }
  });
});
