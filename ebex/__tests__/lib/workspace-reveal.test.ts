import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFile, createFolder } from "@/lib/workspace-mutations";
import {
  buildRevealCommand,
  revealTargetInOs,
} from "@/lib/workspace-reveal";

describe("buildRevealCommand", () => {
  it("builds Windows file select command", () => {
    expect(buildRevealCommand("C:\\ws\\a.md", true, "win32")).toEqual({
      command: "explorer.exe",
      args: ["/select,C:\\ws\\a.md"],
    });
  });

  it("builds Windows folder command", () => {
    expect(buildRevealCommand("C:\\ws\\demo", false, "win32")).toEqual({
      command: "explorer.exe",
      args: ["C:\\ws\\demo"],
    });
  });

  it("builds macOS reveal command", () => {
    expect(buildRevealCommand("/tmp/a.md", true, "darwin")).toEqual({
      command: "open",
      args: ["-R", "/tmp/a.md"],
    });
  });
});

describe("revealTargetInOs", () => {
  it("rejects missing files", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-reveal-"));
    createFolder(tmpDir, "demo");
    const result = await revealTargetInOs(
      tmpDir,
      { folderPath: "demo", fileName: "missing.md" },
      { runner: vi.fn() },
    );
    expect(result).toEqual({
      error: "ファイルが見つかりません",
      status: 404,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("invokes runner for an existing file", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-reveal-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "hi");
    const runner = vi.fn().mockResolvedValue(undefined);
    const result = await revealTargetInOs(
      tmpDir,
      { folderPath: "demo", fileName: "notes.md" },
      { platform: "darwin", runner },
    );
    expect(result).toEqual({ ok: true });
    expect(runner).toHaveBeenCalledOnce();
    expect(runner.mock.calls[0]?.[0]).toBe("open");
    expect(runner.mock.calls[0]?.[1]?.[0]).toBe("-R");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
