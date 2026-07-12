import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  executeRegisteredTool,
  isLikelyBlockedToolName,
  resolveToolDefinitions,
} from "@/lib/agent/tools/registry";
import { createFile, createFolder } from "@/lib/workspace-mutations";
import { getWorkspaceDir } from "@/lib/workspace-paths";

const contextFor = (tmpDir: string, folderId: string) => ({
  projectRoot: tmpDir,
  projectFolderId: folderId,
});

describe("resolveToolDefinitions", () => {
  it("always includes L1-L3 workspace tools", () => {
    const defs = resolveToolDefinitions([]);
    const names = defs.map((d) => d.name);
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("list_files");
    expect(names).not.toContain("delete_file");
  });
});

describe("executeRegisteredTool", () => {
  it("lists files in project folder", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "a.md", "a");
    const outcome = await executeRegisteredTool(
      "list_files",
      { path: "." },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      path: "workspace/demo/.",
      entries: expect.arrayContaining([{ name: "a.md", type: "file" }]),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads file with truncation metadata", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const long = "x".repeat(100_001);
    createFile(tmpDir, "demo", "big.txt", long);
    const outcome = await executeRegisteredTool(
      "read_file",
      { path: "big.txt" },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      path: "workspace/demo/big.txt",
      truncated: true,
      totalChars: 100_001,
    });
    expect((outcome.result as { content: string }).content).toHaveLength(100_000);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes new file and returns path and bytes only", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const content = "# Minutes\n\nHello";
    const outcome = await executeRegisteredTool(
      "write_file",
      { path: "output/minutes.md", content },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toEqual({
      path: "workspace/demo/output/minutes.md",
      bytes: Buffer.byteLength(content, "utf-8"),
    });
    const written = fs.readFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", "output", "minutes.md"),
      "utf-8",
    );
    expect(written).toBe(content);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("blocks delete-like tool names", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const outcome = await executeRegisteredTool(
      "delete_file",
      { path: "notes.md" },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      blocked: true,
      reason: expect.stringContaining("削除"),
      guidance: expect.stringContaining("手動削除"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("blocks command execution tool names", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const outcome = await executeRegisteredTool(
      "run_command",
      { command: "npm install" },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      blocked: true,
      command: "npm install",
      reason: expect.stringContaining("コマンド"),
      guidance: expect.stringContaining("ターミナル"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads skill references via relative path without writing skill dir", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "purpose.md"),
      "パーパス本文",
    );
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: m\n---\n");

    const outcome = await executeRegisteredTool(
      "read_file",
      { path: "references/purpose.md" },
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
      },
    );
    expect(outcome.result).toMatchObject({
      path: "skill/minutes-maid/references/purpose.md",
      content: "パーパス本文",
    });

    const writeOutcome = await executeRegisteredTool(
      "write_file",
      { path: "skill/minutes-maid/hack.md", content: "nope" },
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
      },
    );
    expect(writeOutcome.result).toMatchObject({
      error: expect.stringContaining("スキルディレクトリへの書込"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("isLikelyBlockedToolName", () => {
  it("detects dangerous tool name hints", () => {
    expect(isLikelyBlockedToolName("delete_file")).toBe(true);
    expect(isLikelyBlockedToolName("run_shell")).toBe(true);
    expect(isLikelyBlockedToolName("read_file")).toBe(false);
  });
});
