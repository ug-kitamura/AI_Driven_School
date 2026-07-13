import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  executeRegisteredTool,
  isLikelyBlockedToolName,
  preflightScriptToolCall,
  resolveToolDefinitions,
} from "@/lib/agent/tools/registry";
import { createFolder } from "@/lib/workspace-mutations";

function makeProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-script-tools-"));
  createFolder(tmpDir, "demo");
  const skillDir = path.join(tmpDir, "skill-zone", "my-skill");
  fs.mkdirSync(path.join(skillDir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
  const context = {
    projectRoot: tmpDir,
    projectFolderId: "demo",
    skillId: "my-skill",
    skillDirAbsolute: skillDir,
  };
  const projectDir = path.join(tmpDir, "workspace", "demo");
  return { tmpDir, skillDir, context, projectDir };
}

describe("script tool definitions", () => {
  it("includes run_script and run_skill_script", () => {
    const names = resolveToolDefinitions([]).map((d) => d.name);
    expect(names).toContain("run_script");
    expect(names).toContain("run_skill_script");
  });

  it("does not treat registered script tools as blocked names", () => {
    expect(isLikelyBlockedToolName("run_script")).toBe(false);
    expect(isLikelyBlockedToolName("run_skill_script")).toBe(false);
    expect(isLikelyBlockedToolName("run_shell")).toBe(true);
  });
});

describe("executeRegisteredTool run_script", () => {
  it("writes a file via sandboxed code and returns summary only", async () => {
    const { tmpDir, context, projectDir } = makeProject();
    const outcome = await executeRegisteredTool(
      "run_script",
      {
        purpose: "テスト成果物の生成",
        code: `const fs = require("fs"); fs.writeFileSync("output.html", "<html>" + "x".repeat(1000) + "</html>"); console.log("built");`,
        writes: ["output.html"],
      },
      context,
    );
    expect(outcome.result).toMatchObject({
      writes: ["workspace/demo/output.html"],
    });
    const record = outcome.result as Record<string, unknown>;
    expect(record.error).toBeUndefined();
    expect(String(record.stdout)).toContain("built");
    // 成果物本文は tool_result に載らない
    expect(JSON.stringify(outcome.result)).not.toContain("<html>");
    expect(fs.existsSync(path.join(projectDir, "output.html"))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects writes declared outside the project", async () => {
    const { tmpDir, context } = makeProject();
    createFolder(tmpDir, "other");
    const outcome = await executeRegisteredTool(
      "run_script",
      {
        purpose: "テスト",
        code: `const fs = require("fs");`,
        writes: ["workspace/other/escape.txt"],
      },
      context,
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("プロジェクト内のパスのみ"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns stderr and exit code on runtime failure", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await executeRegisteredTool(
      "run_script",
      {
        purpose: "テスト",
        code: `throw new Error("boom-runtime");`,
        writes: [],
      },
      context,
    );
    const record = outcome.result as Record<string, unknown>;
    expect(String(record.error)).toContain("スクリプト実行エラー");
    expect(String(record.stderr)).toContain("boom-runtime");
    expect(record.recoverable).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("executeRegisteredTool run_skill_script", () => {
  it("runs a script bundled in the running skill", async () => {
    const { tmpDir, skillDir, context, projectDir } = makeProject();
    fs.writeFileSync(
      path.join(skillDir, "scripts", "build.cjs"),
      `const fs = require("fs"); fs.writeFileSync(process.argv[2] ?? "out.txt", "built-by-skill");`,
      "utf-8",
    );
    const outcome = await executeRegisteredTool(
      "run_skill_script",
      {
        script_path: "scripts/build.cjs",
        args: ["result.txt"],
        purpose: "スキルスクリプトの実行",
      },
      context,
    );
    expect(outcome.result).toMatchObject({
      script: "skill/my-skill/scripts/build.cjs",
    });
    expect(fs.readFileSync(path.join(projectDir, "result.txt"), "utf-8")).toBe(
      "built-by-skill",
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects scripts outside the running skill scripts dir", async () => {
    const { tmpDir, skillDir, context } = makeProject();
    fs.writeFileSync(
      path.join(skillDir, "references", "not-a-script.cjs"),
      "1;",
      "utf-8",
    );
    const outcome = await executeRegisteredTool(
      "run_skill_script",
      { script_path: "references/not-a-script.cjs", purpose: "テスト" },
      context,
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("scripts/ 配下"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects missing scripts", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await executeRegisteredTool(
      "run_skill_script",
      { script_path: "scripts/missing.cjs", purpose: "テスト" },
      context,
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("見つかりません"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects when no skill is running", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-script-tools-"));
    createFolder(tmpDir, "demo");
    const outcome = await executeRegisteredTool(
      "run_skill_script",
      { script_path: "scripts/build.cjs", purpose: "テスト" },
      { projectRoot: tmpDir, projectFolderId: "demo" },
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("実行中スキルがない"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("preflightScriptToolCall", () => {
  it("returns syntax error outcome before confirmation", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await preflightScriptToolCall(
      "run_script",
      {
        purpose: "テスト",
        code: `const fs = require("fs"; broken`,
        writes: [],
      },
      context,
    );
    expect(outcome).not.toBeNull();
    expect(outcome?.result).toMatchObject({
      error: expect.stringContaining("構文エラー"),
      recoverable: true,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes valid code through to confirmation", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await preflightScriptToolCall(
      "run_script",
      { purpose: "テスト", code: `const fs = require("fs");`, writes: [] },
      context,
    );
    expect(outcome).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects missing skill scripts before confirmation", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await preflightScriptToolCall(
      "run_skill_script",
      { script_path: "scripts/missing.cjs", purpose: "テスト" },
      context,
    );
    expect(outcome).not.toBeNull();
    expect(outcome?.result).toMatchObject({
      error: expect.stringContaining("見つかりません"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for non-script tools", async () => {
    const { tmpDir, context } = makeProject();
    const outcome = await preflightScriptToolCall(
      "write_file",
      { path: "a.md", content: "x" },
      context,
    );
    expect(outcome).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
