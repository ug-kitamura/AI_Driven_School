import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  executeRegisteredTool,
  isLikelyBlockedToolName,
  resolveToolDefinitions,
  skillHasScriptsDir,
  WRITE_FILE_CHAR_LIMIT,
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

  it("excludes run_skill_script when skill has no scripts/", () => {
    const names = resolveToolDefinitions([], { hasSkillScripts: false }).map(
      (d) => d.name,
    );
    expect(names).not.toContain("run_skill_script");
    // run_script（プロジェクト実行）は常に残る
    expect(names).toContain("run_script");
  });

  it("excludes run_skill_script by default (no skill running)", () => {
    const names = resolveToolDefinitions([]).map((d) => d.name);
    expect(names).not.toContain("run_skill_script");
  });

  it("includes run_skill_script when skill has scripts/", () => {
    const names = resolveToolDefinitions([], { hasSkillScripts: true }).map(
      (d) => d.name,
    );
    expect(names).toContain("run_skill_script");
  });
});

describe("skillHasScriptsDir", () => {
  it("returns false without a skill dir", () => {
    expect(skillHasScriptsDir(undefined)).toBe(false);
    expect(skillHasScriptsDir("")).toBe(false);
  });

  it("detects an existing scripts/ directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-skill-"));
    expect(skillHasScriptsDir(tmpDir)).toBe(false);
    fs.mkdirSync(path.join(tmpDir, "scripts"));
    expect(skillHasScriptsDir(tmpDir)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns false when scripts is a file, not a directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-skill-"));
    fs.writeFileSync(path.join(tmpDir, "scripts"), "not a dir");
    expect(skillHasScriptsDir(tmpDir)).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("L1 discovery with file-scope path", () => {
  const setup = () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-l1-file-"));
    createFolder(tmpDir, "demo");
    const outputDir = path.join(getWorkspaceDir(tmpDir), "demo", "output");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, "minutes.html"),
      "<html>PLACEHOLDER target</html>",
    );
    fs.writeFileSync(path.join(outputDir, "other.html"), "<html>target</html>");
    return { tmpDir, context: contextFor(tmpDir, "demo") };
  };

  it("search_content with file path searches only that file (no ENOTDIR)", async () => {
    const { tmpDir, context } = setup();
    const outcome = await executeRegisteredTool(
      "search_content",
      { query: "target", path: "output/minutes.html" },
      context,
    );
    const result = outcome.result as {
      hits: Array<{ path: string }>;
    };
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].path).toBe("output/minutes.html");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("glob_files with file path returns 1 on relative-path match, excluding siblings", async () => {
    const { tmpDir, context } = setup();
    const outcome = await executeRegisteredTool(
      "glob_files",
      { pattern: "output/*.html", path: "output/minutes.html" },
      context,
    );
    expect(outcome.result).toMatchObject({
      matches: ["output/minutes.html"],
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("glob_files with file path matches by basename too", async () => {
    const { tmpDir, context } = setup();
    // "*" は "/" を跨がないためフルパスには不一致だが、basename で一致する
    const outcome = await executeRegisteredTool(
      "glob_files",
      { pattern: "*.html", path: "output/minutes.html" },
      context,
    );
    expect(outcome.result).toMatchObject({
      matches: ["output/minutes.html"],
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("glob_files with file path returns 0 without throwing when pattern mismatches", async () => {
    const { tmpDir, context } = setup();
    const outcome = await executeRegisteredTool(
      "glob_files",
      { pattern: "*.md", path: "output/minutes.html" },
      context,
    );
    expect(outcome.result).toMatchObject({ matches: [] });
    expect(outcome.result).not.toHaveProperty("error");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("list_files with file path returns a single file entry", async () => {
    const { tmpDir, context } = setup();
    const outcome = await executeRegisteredTool(
      "list_files",
      { path: "output/minutes.html" },
      context,
    );
    expect(outcome.result).toMatchObject({
      entries: [{ name: "minutes.html", type: "file" }],
    });
    expect(outcome.result).not.toHaveProperty("error");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("search_content scopes to a skill file with host-independent display path", async () => {
    const { tmpDir, context } = setup();
    const skillDir = path.join(tmpDir, "skill-zone", "my-skill");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<title>{{MEETING_TITLE}}</title>",
    );
    const outcome = await executeRegisteredTool(
      "search_content",
      { query: "{{MEETING_TITLE}}", path: "references/base.html" },
      { ...context, skillId: "my-skill", skillDirAbsolute: skillDir },
    );
    const result = outcome.result as { hits: Array<{ path: string }> };
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].path).toBe("skill/my-skill/references/base.html");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not throw for nonexistent paths (glob/search return 0, list errors)", async () => {
    const { tmpDir, context } = setup();
    const glob = await executeRegisteredTool(
      "glob_files",
      { pattern: "*", path: "nope" },
      context,
    );
    expect(glob.result).toMatchObject({ matches: [] });
    const search = await executeRegisteredTool(
      "search_content",
      { query: "x", path: "nope" },
      context,
    );
    expect(search.result).toMatchObject({ hits: [] });
    const list = await executeRegisteredTool(
      "list_files",
      { path: "nope" },
      context,
    );
    expect(list.result).toHaveProperty("error");
    fs.rmSync(tmpDir, { recursive: true, force: true });
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

  it("writes html content as-is even when skill references/base.html exists", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, "skill-zone", "any-skill");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html>TEMPLATE</html>",
    );
    const content = "<html>MODEL CONTENT</html>";
    const outcome = await executeRegisteredTool(
      "write_file",
      { path: "output/out.html", content },
      {
        ...contextFor(tmpDir, "demo"),
        skillId: "any-skill",
        skillDirAbsolute: skillDir,
      },
    );
    expect(outcome.result).toMatchObject({
      path: "workspace/demo/output/out.html",
    });
    const written = fs.readFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", "output", "out.html"),
      "utf-8",
    );
    expect(written).toBe(content);
    expect(written).not.toContain("TEMPLATE");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects write_file content over the size limit without writing", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const oversized = "x".repeat(WRITE_FILE_CHAR_LIMIT + 1);
    const outcome = await executeRegisteredTool(
      "write_file",
      { path: "output/big.html", content: oversized },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      recoverable: true,
      guidance: expect.stringContaining("copy_file"),
    });
    expect((outcome.result as { error: string }).error).toContain(
      String(WRITE_FILE_CHAR_LIMIT),
    );
    expect(
      fs.existsSync(
        path.join(getWorkspaceDir(tmpDir), "demo", "output", "big.html"),
      ),
    ).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not overwrite an existing file when content exceeds the limit", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "keep.html", "original");
    const oversized = "y".repeat(WRITE_FILE_CHAR_LIMIT + 1);
    const outcome = await executeRegisteredTool(
      "write_file",
      { path: "keep.html", content: oversized },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({ recoverable: true });
    const kept = fs.readFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", "keep.html"),
      "utf-8",
    );
    expect(kept).toBe("original");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes content exactly at the size limit", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const atLimit = "z".repeat(WRITE_FILE_CHAR_LIMIT);
    const outcome = await executeRegisteredTool(
      "write_file",
      { path: "output/edge.md", content: atLimit },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      path: "workspace/demo/output/edge.md",
    });
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

  it("blocks MCP / external connector tool names", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    const outcome = await executeRegisteredTool(
      "mcp__github__get_issue",
      { query: "x" },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      blocked: true,
      reason: expect.stringContaining("外部コネクタ"),
    });
    expect(isLikelyBlockedToolName("mcp__github__get_issue")).toBe(true);
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
      templateStatus: {
        complete: true,
        remainingPlaceholders: [],
        emptySections: [],
      },
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

  it("hints whitespace-only near miss on replace_in_file miss", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "</ol>\n    </div>");

    const outcome = await executeRegisteredTool(
      "replace_in_file",
      {
        path: "out.html",
        old_string: "</ol> </div>",
        new_string: "x",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("近い候補（空白差のみ）"),
    });
    expect(String((outcome.result as { error: string }).error)).toContain(
      "</ol>",
    );
    expect(
      fs.readFileSync(
        path.join(getWorkspaceDir(tmpDir), "demo", "out.html"),
        "utf-8",
      ),
    ).toBe("</ol>\n    </div>");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not replace when miss has no whitespace-only candidate", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "<p>hello</p>");

    const outcome = await executeRegisteredTool(
      "replace_in_file",
      {
        path: "out.html",
        old_string: "</ol> </div>",
        new_string: "x",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      error: expect.stringContaining("置換対象が見つかりません"),
    });
    expect(String((outcome.result as { error: string }).error)).not.toContain(
      "近い候補",
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("warns on residual fill tokens after successful replace", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(
      tmpDir,
      "demo",
      "out.html",
      "<h1>{{TITLE}}</h1><p>{{TOPIC_TITLE_N}}</p>",
    );

    const outcome = await executeRegisteredTool(
      "replace_in_file",
      { path: "out.html", replacements: { TITLE: "月例" } },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      path: "workspace/demo/out.html",
      replacements: 1,
      warning: expect.stringContaining("{{TOPIC_TITLE_N}}"),
    });
    expect(outcome.display.tags).toContain("warning");
    expect(outcome.display.display).toContain("⚠");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not warn on HTML comments or span markers alone", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(
      tmpDir,
      "demo",
      "out.html",
      "<!-- FILL: note -->{{AGENDA_START}}\n{{AGENDA_END}}",
    );

    const outcome = await executeRegisteredTool(
      "replace_between",
      {
        path: "out.html",
        start_marker: "{{AGENDA_START}}",
        end_marker: "{{AGENDA_END}}",
        content: "\n<li>ok</li>\n",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(outcome.result).toMatchObject({
      path: "workspace/demo/out.html",
    });
    expect(outcome.result).not.toHaveProperty("warning");
    expect(outcome.display.tags ?? []).not.toContain("warning");
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

  it("minutes-like frame: span replace + residual warning + whitespace hint", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tools-"));
    createFolder(tmpDir, "demo");
    createFile(
      tmpDir,
      "demo",
      "minutes.html",
      [
        "<ol>",
        "{{AGENDA_ITEMS_START}}",
        "{{AGENDA_ITEMS_END}}",
        "</ol>",
        "<h1>{{MEETING_TITLE}}</h1>",
      ].join("\n"),
    );

    const miss = await executeRegisteredTool(
      "replace_between",
      {
        path: "minutes.html",
        start_marker: "{{AGENDA_ITEMS_START}}",
        end_marker: "{{AGENDA_ITEMS_END}}\n</ol> </div>",
        content: "\n<li>x</li>\n",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(miss.result).toMatchObject({
      error: expect.stringContaining("end_marker"),
    });

    const ok = await executeRegisteredTool(
      "replace_between",
      {
        path: "minutes.html",
        start_marker: "{{AGENDA_ITEMS_START}}",
        end_marker: "{{AGENDA_ITEMS_END}}",
        content: "\n<li>部長挨拶</li>\n",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(ok.result).toMatchObject({
      path: "workspace/demo/minutes.html",
      warning: expect.stringContaining("{{MEETING_TITLE}}"),
    });
    expect(ok.display.tags).toContain("warning");
    const written = fs.readFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", "minutes.html"),
      "utf-8",
    );
    expect(written).toContain("<li>部長挨拶</li>");
    expect(written).not.toContain("{{TOPIC_TITLE_N}}");
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

    createFile(tmpDir, "demo", "marked.html", "<ol>\n</ol>\n    </div>");
    const whitespaceMiss = await executeRegisteredTool(
      "replace_between",
      {
        path: "marked.html",
        start_marker: "<ol>",
        end_marker: "</ol> </div>",
        content: "x",
      },
      contextFor(tmpDir, "demo"),
    );
    expect(whitespaceMiss.result).toMatchObject({
      error: expect.stringContaining("近い候補（空白差のみ）"),
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

  it("acceptance: visual-explainer references/* then copy+replace_between", async () => {
    const skillDir = path.resolve(
      process.cwd(),
      ".claude/skills/visual-explainer",
    );
    expect(fs.existsSync(path.join(skillDir, "references", "base.html"))).toBe(
      true,
    );

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-viz-accept-"));
    createFolder(tmpDir, "demo");
    const ctx = {
      projectRoot: tmpDir,
      projectFolderId: "demo",
      skillId: "visual-explainer",
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
      expect.arrayContaining(["skill/visual-explainer/references/base.html"]),
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
