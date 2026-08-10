import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectWrittenPathsFromToolResult,
  resolveConfirmRequirement,
} from "@/lib/agent/tools/confirm-gate";
import { createFile, createFolder } from "@/lib/workspace-mutations";
import { getWorkspaceDir } from "@/lib/workspace-paths";

describe("resolveConfirmRequirement", () => {
  it("does not require confirm for project-internal read tools", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "hello");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "read_file",
      input: { path: "notes.md" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires confirm for outside-project read", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFolder(tmpDir, "other");
    createFile(tmpDir, "other", "notes.md", "hello");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "read_file",
      input: { path: "workspace/other/notes.md" },
    });
    expect(req).toEqual({
      kind: "outside-project-read",
      path: "workspace/other/notes.md",
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not require confirm for new write inside project", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "write_file",
      input: { path: "output/new.md", content: "x" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires overwrite confirm for existing file inside project", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "old");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "write_file",
      input: { path: "notes.md", content: "new" },
    });
    expect(req).toEqual({
      kind: "overwrite",
      path: "workspace/demo/notes.md",
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires outside-project-write with isNew flag", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFolder(tmpDir, "other");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "write_file",
      input: { path: "workspace/other/new.md", content: "x" },
    });
    expect(req).toEqual({
      kind: "outside-project-write",
      path: "workspace/other/new.md",
      isNew: true,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("marks outside-project-write overwrite when file exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFolder(tmpDir, "other");
    const otherAbs = path.join(getWorkspaceDir(tmpDir), "other", "notes.md");
    fs.mkdirSync(path.dirname(otherAbs), { recursive: true });
    fs.writeFileSync(otherAbs, "old");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "write_file",
      input: { path: "workspace/other/notes.md", content: "new" },
    });
    expect(req).toEqual({
      kind: "outside-project-write",
      path: "workspace/other/notes.md",
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not require confirm for skill-zone reads", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(path.join(skillDir, "references", "purpose.md"), "x");
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: m\n---\n");

    const req = resolveConfirmRequirement(
      tmpDir,
      "demo",
      {
        id: "t1",
        name: "read_file",
        input: { path: "references/purpose.md" },
      },
      {
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
      },
    );
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires overwrite confirm when copy_file target exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "dest.html", "old");
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(path.join(skillDir, "references", "base.html"), "base");

    const req = resolveConfirmRequirement(
      tmpDir,
      "demo",
      {
        id: "t1",
        name: "copy_file",
        input: { from: "references/base.html", to: "dest.html" },
      },
      { skillId: "minutes-maid", skillDirAbsolute: skillDir },
    );
    expect(req).toEqual({
      kind: "overwrite",
      path: "workspace/demo/dest.html",
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires overwrite confirm for replace_in_file on existing file", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "{{TITLE}}");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "replace_in_file",
      input: { path: "out.html", replacements: { TITLE: "x" } },
    });
    expect(req).toEqual({
      kind: "overwrite",
      path: "workspace/demo/out.html",
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips overwrite when path was agent-created (skipOverwritePaths)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "{{TITLE}}");
    const skip = new Set(["workspace/demo/out.html"]);
    const req = resolveConfirmRequirement(
      tmpDir,
      "demo",
      {
        id: "t1",
        name: "replace_in_file",
        input: { path: "out.html", replacements: { TITLE: "x" } },
      },
      { skipOverwritePaths: skip },
    );
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("skips overwrite for write_file after user approved once", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "old");
    const req = resolveConfirmRequirement(
      tmpDir,
      "demo",
      {
        id: "t1",
        name: "write_file",
        input: { path: "notes.md", content: "new" },
      },
      { skipOverwritePaths: new Set(["workspace/demo/notes.md"]) },
    );
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("requires overwrite for replace_between and append_file on existing files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "x");
    createFile(tmpDir, "demo", "partial.txt", "a");

    expect(
      resolveConfirmRequirement(tmpDir, "demo", {
        id: "t1",
        name: "replace_between",
        input: {
          path: "out.html",
          start_marker: "a",
          end_marker: "b",
          content: "c",
        },
      }),
    ).toEqual({
      kind: "overwrite",
      path: "workspace/demo/out.html",
      isNew: false,
    });

    expect(
      resolveConfirmRequirement(tmpDir, "demo", {
        id: "t2",
        name: "append_file",
        input: { path: "partial.txt", content: "b" },
      }),
    ).toEqual({
      kind: "overwrite",
      path: "workspace/demo/partial.txt",
      isNew: false,
    });

    expect(
      resolveConfirmRequirement(
        tmpDir,
        "demo",
        {
          id: "t3",
          name: "append_file",
          input: { path: "partial.txt", content: "b" },
        },
        { skipOverwritePaths: new Set(["workspace/demo/partial.txt"]) },
      ),
    ).toBeNull();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not require overwrite confirm for existing files under _work/", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const workAbs = path.join(
      getWorkspaceDir(tmpDir),
      "demo",
      "_work",
      "agenda_details_all.html",
    );
    fs.mkdirSync(path.dirname(workAbs), { recursive: true });
    fs.writeFileSync(workAbs, "old");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "write_file",
      input: { path: "_work/agenda_details_all.html", content: "new" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("still requires overwrite confirm outside _work/ in the same project", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "_work_report.html", "old");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "write_file",
      input: { path: "_work_report.html", content: "new" },
    });
    expect(req).toEqual({
      kind: "overwrite",
      path: "workspace/demo/_work_report.html",
      isNew: false,
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("resolveConfirmRequirement for web_search", () => {
  it("uses web-search kind when search is available (key set)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const req = resolveConfirmRequirement(
      tmpDir,
      "demo",
      {
        id: "t1",
        name: "web_search",
        input: { query: "next.js 16", purpose: "調査" },
      },
      { searchAvailable: true },
    );
    expect(req?.kind).toBe("web-search");
    expect(req?.search).toEqual({ query: "next.js 16", purpose: "調査" });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses web-search-manual kind when search is unavailable (no key)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const req = resolveConfirmRequirement(
      tmpDir,
      "demo",
      {
        id: "t1",
        name: "web_search",
        input: { query: "next.js 16", purpose: "調査" },
      },
      { searchAvailable: false },
    );
    expect(req?.kind).toBe("web-search-manual");
    expect(req?.search).toEqual({ query: "next.js 16", purpose: "調査" });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for empty query", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const req = resolveConfirmRequirement(
      tmpDir,
      "demo",
      { id: "t1", name: "web_search", input: { query: "  " } },
      { searchAvailable: false },
    );
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("resolveConfirmRequirement for script tools", () => {
  it("requires confirmation for run_script every time (no skip)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "old");
    const call = {
      id: "t1",
      name: "run_script",
      input: {
        purpose: "HTML の組み立て",
        code: 'const fs = require("fs");',
        writes: ["out.html", "new.txt"],
      },
    };
    const req = resolveConfirmRequirement(tmpDir, "demo", call, {
      skipOverwritePaths: new Set(["workspace/demo/out.html"]),
    });
    expect(req).not.toBeNull();
    expect(req?.kind).toBe("run-script");
    expect(req?.script?.purpose).toBe("HTML の組み立て");
    expect(req?.script?.writes).toEqual([
      { path: "workspace/demo/out.html", exists: true },
      { path: "workspace/demo/new.txt", exists: false },
    ]);
    expect(req?.script?.networkWarning).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("flags network access hints in run_script code", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "run_script",
      input: {
        purpose: "テスト",
        code: 'const https = require("https"); fetch("https://example.com");',
        writes: [],
      },
    });
    expect(req?.script?.networkWarning).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for run_script with empty code (broken tool_use path)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "run_script",
      input: { purpose: "テスト", code: "", writes: [] },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("builds run-skill-script confirmation with script code preview", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, "skill-zone", "my-skill");
    fs.mkdirSync(path.join(skillDir, "scripts"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "scripts", "build.cjs"),
      'const fs = require("fs");',
      "utf-8",
    );
    const req = resolveConfirmRequirement(
      tmpDir,
      "demo",
      {
        id: "t1",
        name: "run_skill_script",
        input: {
          script_path: "scripts/build.cjs",
          args: ["out.html"],
          purpose: "スキルスクリプト",
        },
      },
      { skillId: "my-skill", skillDirAbsolute: skillDir },
    );
    expect(req?.kind).toBe("run-skill-script");
    expect(req?.path).toBe("skill/my-skill/scripts/build.cjs");
    expect(req?.script?.scriptPath).toBe("skill/my-skill/scripts/build.cjs");
    expect(req?.script?.code).toContain("require");
    expect(req?.script?.args).toEqual(["out.html"]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("resolveConfirmRequirement for generate_and_write", () => {
  it("requires confirmation every time, even for new and skip-listed paths", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const call = {
      id: "t1",
      name: "generate_and_write",
      input: {
        purpose: "図解本文の生成",
        path: "output/partial.html",
        instruction: "図解を書く",
        sections: ["導入", "本論"],
        context_paths: ["notes.md"],
      },
    };
    const req = resolveConfirmRequirement(tmpDir, "demo", call, {
      skipOverwritePaths: new Set(["workspace/demo/output/partial.html"]),
    });
    expect(req).not.toBeNull();
    expect(req?.kind).toBe("generate-write");
    expect(req?.path).toBe("workspace/demo/output/partial.html");
    expect(req?.isNew).toBe(true);
    expect(req?.generate).toEqual({
      purpose: "図解本文の生成",
      instruction: "図解を書く",
      sections: ["導入", "本論"],
      contextPaths: ["notes.md"],
    });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("shows the target section when marker is given", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(
      tmpDir,
      "demo",
      "framed.html",
      "<!-- CONTENT_START --><!-- CONTENT_END -->",
    );
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "generate_and_write",
      input: {
        purpose: "p",
        path: "framed.html",
        instruction: "書く",
        marker: "<!-- CONTENT_START -->",
      },
    });
    expect(req?.kind).toBe("generate-write");
    // 完全形で渡されても素名で表示する
    expect(req?.generate?.marker).toBe("CONTENT");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("omits marker from the payload when not given", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "generate_and_write",
      input: { purpose: "p", path: "out.html", instruction: "書く" },
    });
    expect(req?.generate).not.toHaveProperty("marker");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("marks overwrite when the target exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "out.html", "old");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "generate_and_write",
      input: { purpose: "p", path: "out.html", instruction: "書く" },
    });
    expect(req?.kind).toBe("generate-write");
    expect(req?.isNew).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("falls back to outside-project-write for outside targets", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    createFolder(tmpDir, "other");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "generate_and_write",
      input: {
        purpose: "p",
        path: "workspace/other/out.html",
        instruction: "書く",
      },
    });
    expect(req?.kind).toBe("outside-project-write");
    expect(req?.path).toBe("workspace/other/out.html");
    expect(req?.isNew).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for missing instruction (broken tool_use path)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-confirm-"));
    createFolder(tmpDir, "demo");
    const req = resolveConfirmRequirement(tmpDir, "demo", {
      id: "t1",
      name: "generate_and_write",
      input: { purpose: "p", path: "out.html" },
    });
    expect(req).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("collects the generate_and_write result path for overwrite skip", () => {
    const paths = collectWrittenPathsFromToolResult({
      path: "workspace/demo/output/partial.html",
      bytes: 12345,
      sections: 2,
      continuations: 1,
      durationMs: 100,
    });
    expect(paths).toEqual(["workspace/demo/output/partial.html"]);
  });
});

describe("collectWrittenPathsFromToolResult with writes", () => {
  it("collects run_script writes for overwrite skip", () => {
    const paths = collectWrittenPathsFromToolResult({
      writes: ["workspace/demo/out.html", "workspace/demo/new.txt"],
      stdout: "",
      durationMs: 10,
    });
    expect(paths).toEqual([
      "workspace/demo/out.html",
      "workspace/demo/new.txt",
    ]);
  });
});
