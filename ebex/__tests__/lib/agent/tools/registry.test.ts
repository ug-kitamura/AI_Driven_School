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
    expect(names).toContain("copy_file");
    expect(names).toContain("replace_in_file");
    expect(names).toContain("replace_between");
    expect(names).toContain("append_file");
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
    expect((outcome.result as { content: string }).content).toHaveLength(
      100_000,
    );
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
      guidance: expect.stringContaining("run_script"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("blocks subagent-like tool names", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const outcome = await executeRegisteredTool(
      "Task",
      { prompt: "review" },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      blocked: true,
      reason: expect.stringContaining("サブエージェント"),
      guidance: expect.stringContaining("同一セッション"),
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

  it("copies skill reference into project folder", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html>{{TITLE}}</html>",
    );

    const outcome = await executeRegisteredTool(
      "copy_file",
      { from: "references/base.html", to: "output/minutes.html" },
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
      },
    );
    expect(outcome.result).toMatchObject({
      from: "skill/minutes-maid/references/base.html",
      to: "workspace/demo/output/minutes.html",
    });
    const written = fs.readFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", "output", "minutes.html"),
      "utf-8",
    );
    expect(written).toBe("<html>{{TITLE}}</html>");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects copy into skill directory", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "a.md", "a");
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(skillDir, { recursive: true });

    const outcome = await executeRegisteredTool(
      "copy_file",
      { from: "a.md", to: "skill/minutes-maid/out.md" },
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
      },
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("スキルディレクトリへのコピー"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("replaces placeholders in project file", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "<h1>{{TITLE}}</h1>");

    const outcome = await executeRegisteredTool(
      "replace_in_file",
      { path: "out.html", replacements: { TITLE: "月例" } },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toEqual({
      path: "workspace/demo/out.html",
      replacements: 1,
    });
    expect(
      fs.readFileSync(
        path.join(getWorkspaceDir(tmpDir), "demo", "out.html"),
        "utf-8",
      ),
    ).toBe("<h1>月例</h1>");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("errors when replace finds no matches", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "<h1>x</h1>");

    const outcome = await executeRegisteredTool(
      "replace_in_file",
      { path: "out.html", replacements: { TITLE: "月例" } },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("置換対象が見つかりません"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("globs skill references/* with path omitted", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "n");
    const skillDir = path.join(tmpDir, ".claude", "skills", "viz");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html></html>",
    );

    const outcome = await executeRegisteredTool(
      "glob_files",
      { pattern: "references/*" },
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "viz",
        skillDirAbsolute: skillDir,
      },
    );
    expect(outcome.result).toMatchObject({
      matches: expect.arrayContaining(["skill/viz/references/base.html"]),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists skill references when path is references", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, ".claude", "skills", "viz");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html></html>",
    );

    const outcome = await executeRegisteredTool(
      "list_files",
      { path: "references" },
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "viz",
        skillDirAbsolute: skillDir,
      },
    );
    expect(outcome.result).toMatchObject({
      path: "skill/viz/references",
      entries: expect.arrayContaining([{ name: "base.html", type: "file" }]),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("keeps path-omitted list_files on project root not skill", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "a.md", "a");
    const skillDir = path.join(tmpDir, ".claude", "skills", "viz");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html></html>",
    );

    const outcome = await executeRegisteredTool(
      "list_files",
      {},
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "viz",
        skillDirAbsolute: skillDir,
      },
    );
    const result = outcome.result as {
      path: string;
      entries: Array<{ name: string }>;
    };
    expect(result.path).toBe("workspace/demo/.");
    expect(result.entries.map((e) => e.name)).toContain("a.md");
    expect(result.entries.map((e) => e.name)).not.toContain("references");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("globs **/base.html from skill when missing in project", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, ".claude", "skills", "viz");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html></html>",
    );

    const outcome = await executeRegisteredTool(
      "glob_files",
      { pattern: "**/base.html" },
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "viz",
        skillDirAbsolute: skillDir,
      },
    );
    expect(outcome.result).toMatchObject({
      matches: ["skill/viz/references/base.html"],
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("replaces between markers with content", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(
      tmpDir,
      "demo",
      "out.html",
      "<!-- CONTENT_START -->\nold\n<!-- CONTENT_END -->",
    );

    const outcome = await executeRegisteredTool(
      "replace_between",
      {
        path: "out.html",
        start_marker: "<!-- CONTENT_START -->",
        end_marker: "<!-- CONTENT_END -->",
        content: "\nnew block\n",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      path: "workspace/demo/out.html",
      replacedChars: expect.any(Number),
    });
    const written = fs.readFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", "out.html"),
      "utf-8",
    );
    expect(written).toBe(
      "<!-- CONTENT_START -->\nnew block\n<!-- CONTENT_END -->",
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("replaces between markers from from_path", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(
      tmpDir,
      "demo",
      "out.html",
      "<!-- CONTENT_START --><!-- CONTENT_END -->",
    );
    createFile(tmpDir, "demo", "partial.txt", "FROM_FILE");

    const outcome = await executeRegisteredTool(
      "replace_between",
      {
        path: "out.html",
        start_marker: "<!-- CONTENT_START -->",
        end_marker: "<!-- CONTENT_END -->",
        from_path: "partial.txt",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({ path: "workspace/demo/out.html" });
    expect(
      fs.readFileSync(
        path.join(getWorkspaceDir(tmpDir), "demo", "out.html"),
        "utf-8",
      ),
    ).toBe("<!-- CONTENT_START -->FROM_FILE<!-- CONTENT_END -->");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects replace_between when markers missing or both sources set", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "no markers");

    const missing = await executeRegisteredTool(
      "replace_between",
      {
        path: "out.html",
        start_marker: "<!-- A -->",
        end_marker: "<!-- B -->",
        content: "x",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(missing.result).toMatchObject({
      error: expect.stringContaining("start_marker"),
    });

    const both = await executeRegisteredTool(
      "replace_between",
      {
        path: "out.html",
        start_marker: "<!-- A -->",
        end_marker: "<!-- B -->",
        content: "x",
        from_path: "out.html",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(both.result).toMatchObject({
      error: expect.stringContaining("同時"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects replace_between and append_file into skill zone", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, ".claude", "skills", "viz");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html></html>",
    );

    const ctx = {
      projectRoot: tmpDir,
      projectFolderId: "demo",
      skillId: "viz",
      skillDirAbsolute: skillDir,
    };
    const between = await executeRegisteredTool(
      "replace_between",
      {
        path: "skill/viz/references/base.html",
        start_marker: "<",
        end_marker: ">",
        content: "x",
      },
      ctx,
    );
    expect(between.result).toMatchObject({
      error: expect.stringContaining("スキルディレクトリへの置換"),
    });

    const append = await executeRegisteredTool(
      "append_file",
      { path: "skill/viz/hack.md", content: "nope" },
      ctx,
    );
    expect(append.result).toMatchObject({
      error: expect.stringContaining("スキルディレクトリへの追記"),
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends to existing and creates new files", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "partial.txt", "a");

    const append = await executeRegisteredTool(
      "append_file",
      { path: "partial.txt", content: "b" },
      contextFor(tmpDir, "demo"),
    );
    expect(append.result).toMatchObject({
      path: "workspace/demo/partial.txt",
      created: false,
    });
    expect(
      fs.readFileSync(
        path.join(getWorkspaceDir(tmpDir), "demo", "partial.txt"),
        "utf-8",
      ),
    ).toBe("ab");

    const create = await executeRegisteredTool(
      "append_file",
      { path: "output/new.partial", content: "fresh" },
      contextFor(tmpDir, "demo"),
    );
    expect(create.result).toMatchObject({
      path: "workspace/demo/output/new.partial",
      created: true,
    });
    expect(
      fs.readFileSync(
        path.join(getWorkspaceDir(tmpDir), "demo", "output", "new.partial"),
        "utf-8",
      ),
    ).toBe("fresh");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("acceptance: creating-visual-explainers references/* then copy+replace_between", async () => {
    const skillDir = path.resolve(
      process.cwd(),
      ".claude/skills/creating-visual-explainers",
    );
    expect(fs.existsSync(path.join(skillDir, "references", "base.html"))).toBe(
      true,
    );

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-viz-accept-"));
    createFolder(tmpDir, "demo");
    const ctx = {
      projectRoot: tmpDir,
      projectFolderId: "demo",
      skillId: "creating-visual-explainers",
      skillDirAbsolute: skillDir,
    };

    const glob = await executeRegisteredTool(
      "glob_files",
      { pattern: "references/*" },
      ctx,
    );
    expect(
      (glob.result as { matches: string[] }).matches.length,
    ).toBeGreaterThan(0);
    expect((glob.result as { matches: string[] }).matches).toEqual(
      expect.arrayContaining([
        "skill/creating-visual-explainers/references/base.html",
      ]),
    );

    await executeRegisteredTool(
      "copy_file",
      { from: "references/base.html", to: "output/accept.html" },
      ctx,
    );
    const between = await executeRegisteredTool(
      "replace_between",
      {
        path: "output/accept.html",
        start_marker: "<!-- CONTENT_START -->",
        end_marker: "<!-- CONTENT_END -->",
        content: "\n<section>受け入れ本文</section>\n",
      },
      ctx,
    );
    expect(between.result).toMatchObject({
      path: "workspace/demo/output/accept.html",
    });
    const written = fs.readFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", "output", "accept.html"),
      "utf-8",
    );
    expect(written).toContain("受け入れ本文");
    expect(written).toContain("<!-- CONTENT_START -->");
    expect(written).toContain("<!-- CONTENT_END -->");
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
