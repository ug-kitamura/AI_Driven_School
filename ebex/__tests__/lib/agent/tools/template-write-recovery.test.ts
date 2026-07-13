import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFolder } from "@/lib/workspace-mutations";
import { getWorkspaceDir } from "@/lib/workspace-paths";
import {
  executeTemplateHtmlCopyWrite,
  extractPathFromPartialJson,
  shouldForceTemplateHtmlCopy,
  skillHasBaseHtml,
} from "@/lib/agent/tools/template-write-recovery";

describe("extractPathFromPartialJson", () => {
  it("extracts path from truncated JSON", () => {
    expect(
      extractPathFromPartialJson(
        '{"path":"output/minutes-2026-07-13.html","content":"<!DOC',
      ),
    ).toBe("output/minutes-2026-07-13.html");
  });
});

describe("executeTemplateHtmlCopyWrite", () => {
  it("copies base.html and inlines style.css", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tmpl-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      '<html><link rel="stylesheet" href="style.css"><body>{{TITLE}}</body></html>',
    );
    fs.writeFileSync(
      path.join(skillDir, "references", "style.css"),
      "body{color:red}",
    );

    expect(skillHasBaseHtml(skillDir)).toBe(true);
    expect(
      shouldForceTemplateHtmlCopy(
        {
          id: "1",
          name: "write_file",
          input: { path: "output/minutes.html", content: "<html>huge</html>" },
        },
        skillDir,
      ),
    ).toBe(true);

    const outcome = await executeTemplateHtmlCopyWrite(
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
      },
      "output/minutes.html",
    );

    expect(outcome?.result).toMatchObject({
      autoTemplateCopy: true,
      cssInlined: true,
    });
    const written = fs.readFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", "output", "minutes.html"),
      "utf-8",
    );
    expect(written).toContain("<style>");
    expect(written).toContain("body{color:red}");
    expect(written).toContain("{{TITLE}}");
    expect(written).not.toContain('href="style.css"');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("recovers path from partialJson when input is empty", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-tmpl-"));
    createFolder(tmpDir, "demo");
    const skillDir = path.join(tmpDir, ".claude", "skills", "minutes-maid");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html>{{TITLE}}</html>",
    );

    const call = {
      id: "1",
      name: "write_file" as const,
      input: {},
      inputParseError: true,
      partialJson: '{"path":"output/x.html","content":"<html',
    };
    expect(shouldForceTemplateHtmlCopy(call, skillDir)).toBe(true);

    const outcome = await executeTemplateHtmlCopyWrite(
      {
        projectRoot: tmpDir,
        projectFolderId: "demo",
        skillId: "minutes-maid",
        skillDirAbsolute: skillDir,
      },
      "output/x.html",
    );
    expect(outcome?.result).toMatchObject({ autoTemplateCopy: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
