import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkPermissionModelSupport,
  checkScriptSyntax,
  resetPermissionModelSupportCache,
  runScriptInSandbox,
  truncateScriptOutput,
  SCRIPT_OUTPUT_CHAR_LIMIT,
} from "@/lib/agent/tools/script-sandbox";

function makeSandboxDirs() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-sandbox-"));
  const projectDir = path.join(base, "project");
  const skillDir = path.join(base, "skill");
  const outsideDir = path.join(base, "outside");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(skillDir, { recursive: true });
  fs.mkdirSync(outsideDir, { recursive: true });
  return { base, projectDir, skillDir, outsideDir };
}

describe("script-sandbox", () => {
  beforeEach(() => {
    resetPermissionModelSupportCache();
  });

  it("supports the permission model on the test environment", async () => {
    await expect(checkPermissionModelSupport()).resolves.toBe(true);
  });

  it("writes inside the project via relative path", async () => {
    const { base, projectDir } = makeSandboxDirs();
    const result = await runScriptInSandbox(
      {
        kind: "code",
        code: `const fs = require("fs"); fs.writeFileSync("out.txt", "hello"); console.log("done");`,
      },
      { projectDirAbsolute: projectDir },
    );
    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, "out.txt"), "utf-8")).toBe(
      "hello",
    );
    if (result.ok) {
      expect(result.stdout).toContain("done");
    }
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("fails when writing outside the project", async () => {
    const { base, projectDir, outsideDir } = makeSandboxDirs();
    const escaped = path.join(outsideDir, "escape.txt").replace(/\\/g, "\\\\");
    const result = await runScriptInSandbox(
      {
        kind: "code",
        code: `const fs = require("fs"); fs.writeFileSync("${escaped}", "x");`,
      },
      { projectDirAbsolute: projectDir },
    );
    expect(result.ok).toBe(false);
    expect(fs.existsSync(path.join(outsideDir, "escape.txt"))).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("スクリプト実行エラー");
    }
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("reads the skill dir but cannot write to it", async () => {
    const { base, projectDir, skillDir } = makeSandboxDirs();
    fs.writeFileSync(
      path.join(skillDir, "base.html"),
      "<html>tpl</html>",
      "utf-8",
    );
    const skillEscaped = skillDir.replace(/\\/g, "\\\\");
    const readResult = await runScriptInSandbox(
      {
        kind: "code",
        code: `const fs = require("fs"); const t = fs.readFileSync("${skillEscaped}\\\\base.html", "utf-8"); fs.writeFileSync("out.html", t); console.log("copied");`,
      },
      { projectDirAbsolute: projectDir, skillDirAbsolute: skillDir },
    );
    expect(readResult.ok).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, "out.html"), "utf-8")).toBe(
      "<html>tpl</html>",
    );

    const writeResult = await runScriptInSandbox(
      {
        kind: "code",
        code: `const fs = require("fs"); fs.writeFileSync("${skillEscaped}\\\\hacked.txt", "x");`,
      },
      { projectDirAbsolute: projectDir, skillDirAbsolute: skillDir },
    );
    expect(writeResult.ok).toBe(false);
    expect(fs.existsSync(path.join(skillDir, "hacked.txt"))).toBe(false);
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("kills scripts that exceed the timeout", async () => {
    const { base, projectDir } = makeSandboxDirs();
    const result = await runScriptInSandbox(
      { kind: "code", code: "for(;;){}" },
      { projectDirAbsolute: projectDir, timeoutMs: 1_500 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain("タイムアウト");
    }
    fs.rmSync(base, { recursive: true, force: true });
  }, 15_000);

  it("blocks spawning child processes", async () => {
    const { base, projectDir } = makeSandboxDirs();
    const result = await runScriptInSandbox(
      {
        kind: "code",
        code: `const cp = require("child_process"); cp.execSync("node -e 1");`,
      },
      { projectDirAbsolute: projectDir },
    );
    expect(result.ok).toBe(false);
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("runs a skill-provided script file with args", async () => {
    const { base, projectDir, skillDir } = makeSandboxDirs();
    const scriptsDir = path.join(skillDir, "scripts");
    fs.mkdirSync(scriptsDir, { recursive: true });
    const scriptPath = path.join(scriptsDir, "build.cjs");
    fs.writeFileSync(
      scriptPath,
      `const fs = require("fs"); fs.writeFileSync(process.argv[2], "built"); console.log("ok");`,
      "utf-8",
    );
    const result = await runScriptInSandbox(
      { kind: "file", scriptPathAbsolute: scriptPath, args: ["result.txt"] },
      { projectDirAbsolute: projectDir, skillDirAbsolute: skillDir },
    );
    expect(result.ok).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, "result.txt"), "utf-8")).toBe(
      "built",
    );
    fs.rmSync(base, { recursive: true, force: true });
  });

  it("detects syntax errors without executing", async () => {
    const result = await checkScriptSyntax(
      `const fs = require("fs"; fs.writeFileSync("x.txt", "boom");`,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
      expect(result.error).not.toContain(os.tmpdir());
    }
  });

  it("accepts valid syntax", async () => {
    const result = await checkScriptSyntax(`const fs = require("fs");`);
    expect(result.ok).toBe(true);
  });

  it("truncates long output", () => {
    const long = "a".repeat(SCRIPT_OUTPUT_CHAR_LIMIT + 100);
    const truncated = truncateScriptOutput(long);
    expect(truncated).toContain("切り詰め");
    expect(truncated.length).toBeLessThan(long.length + 100);
  });
});
