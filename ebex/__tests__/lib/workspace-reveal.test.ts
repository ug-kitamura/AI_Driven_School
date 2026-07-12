import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFile, createFolder } from "@/lib/workspace-mutations";
import {
  buildRevealCommand,
  buildWindowsRevealFocusScript,
  revealTargetInOs,
} from "@/lib/workspace-reveal";

describe("buildWindowsRevealFocusScript", () => {
  it("opens with select and focuses the Explorer window", () => {
    const script = buildWindowsRevealFocusScript("C:\\ws\\a.md", true);
    expect(script).toContain("C:\\ws\\a.md");
    expect(script).toContain("/select");
    expect(script).toContain("SetForegroundWindow");
    expect(script).toContain("AllowFocus");
  });

  it("escapes single quotes in paths", () => {
    const script = buildWindowsRevealFocusScript("C:\\o'reilly\\a.md", true);
    expect(script).toContain("C:\\o''reilly\\a.md");
  });
});

describe("buildRevealCommand", () => {
  it("uses PowerShell focus script on Windows", () => {
    const command = buildRevealCommand("C:\\ws\\a.md", true, "win32");
    expect(command.command).toBe("powershell.exe");
    expect(command.args).toContain("-EncodedCommand");
    expect(command.args.at(-1)?.length).toBeGreaterThan(20);
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

  it("invokes PowerShell focus flow on Windows", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-reveal-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "hi");
    const runner = vi.fn().mockResolvedValue(undefined);
    const result = await revealTargetInOs(
      tmpDir,
      { folderPath: "demo", fileName: "notes.md" },
      { platform: "win32", runner },
    );
    expect(result).toEqual({ ok: true });
    expect(runner.mock.calls[0]?.[0]).toBe("powershell.exe");
    expect(runner.mock.calls[0]?.[1]).toContain("-EncodedCommand");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
