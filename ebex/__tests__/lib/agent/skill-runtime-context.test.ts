import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildSkillRuntimeContext,
  FRAME_CANDIDATE_LIMIT,
  mergeSkillSystemPrompt,
  resolveSkillAssetCandidates,
  scanSkillFrameCandidates,
} from "@/lib/agent/skill-runtime-context";
import {
  findOutsideProjectPathHints,
  isPathInsideProjectFolder,
  listDefaultOutputDestinations,
} from "@/lib/agent/skill-io-boundary";

describe("buildSkillRuntimeContext", () => {
  it("mentions scope focus and boundary", () => {
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      currentFileRelativePath: "sub/notes.md",
    });
    expect(text).toContain("Scope");
    expect(text).toContain("demo");
    expect(text).toContain("sub/notes.md");
    expect(text).toContain("Boundary");
  });

  it("includes an image/multimodal hint when imageIoSkipped is set", () => {
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      imageIoSkipped: true,
    });
    expect(text).toContain("Image / Multimodal");
    expect(text).toContain("画像・マルチモーダル");
  });

  it("omits the image/multimodal hint when imageIoSkipped is not set", () => {
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
    });
    expect(text).not.toContain("Image / Multimodal");
  });

  it("mentions skill discovery and read zone when skillId is set", () => {
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "minutes-maid",
    });
    expect(text).toContain("references/*");
    expect(text).toContain("references/purpose.md");
    expect(text).toMatch(/発見|list\/glob\/search/);
    expect(text).toContain("replace_between");
    expect(text).toContain("明示の開始・終了トークン");
    expect(text).not.toContain(".claude/skills/");
    expect(text).not.toMatch(/Jinja|Django|Vue/);
    expect(text).not.toContain("minutes-maid 専用");
  });

  it("presents form→route mapping and the read-restraint note", () => {
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "minutes-maid",
    });
    // 形→経路の一意対応（copy_file 主経路・generate_and_write・run_script）
    expect(text).toContain("copy_file");
    expect(text).toContain("generate_and_write");
    expect(text).toContain("run_script");
    // 読み込み抑制と context_paths 案内
    expect(text).toContain("context_paths");
    expect(text).toMatch(/超えて読み込まない/);
    // フォールバック順序の表現を含まない
    expect(text).not.toContain("失敗したら");
  });

  it("does not mention run_skill_script when the skill has no scripts/", () => {
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "minutes-maid",
    });
    expect(text).not.toContain("run_skill_script");
  });

  it("mentions run_skill_script only when the skill has scripts/", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-runtime-"));
    const skillDir = path.join(tmpDir, "skill");
    fs.mkdirSync(path.join(skillDir, "scripts"), { recursive: true });

    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "with-scripts",
      skillDirAbsolute: skillDir,
    });
    expect(text).toContain("run_skill_script");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("lists frame candidates from scan and recommends copy-first", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-runtime-"));
    const skillDir = path.join(tmpDir, "skill");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html></html>",
    );
    fs.writeFileSync(path.join(skillDir, "references", "style.css"), "body{}");

    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "any-skill",
      skillDirAbsolute: skillDir,
    });
    expect(text).toContain("references/base.html");
    expect(text).toContain("references/style.css");
    expect(text).toContain("額縁候補");
    expect(text).toMatch(/copy_file.*コピー/);
    expect(text).not.toContain("HTML template outputs");
    expect(text).not.toContain("HTML 全文を書いてはならない");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prefers declared assets over scan results", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-runtime-"));
    const skillDir = path.join(tmpDir, "skill");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.mkdirSync(path.join(skillDir, "templates"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html></html>",
    );
    fs.writeFileSync(
      path.join(skillDir, "references", "extra.html"),
      "<html>extra</html>",
    );
    fs.writeFileSync(
      path.join(skillDir, "templates", "card.svg"),
      "<svg></svg>",
    );

    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "any-skill",
      skillDirAbsolute: skillDir,
      skillAssets: ["references/base.html"],
    });
    expect(text).toContain("references/base.html");
    expect(text).not.toContain("extra.html");
    expect(text).not.toContain("card.svg");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("omits the frame-candidate block when there are zero candidates", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-runtime-"));
    const skillDir = path.join(tmpDir, "skill");
    fs.mkdirSync(skillDir, { recursive: true });

    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "plain-skill",
      skillDirAbsolute: skillDir,
    });
    expect(text).not.toContain("額縁候補");
    expect(text).toContain("_work/");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("includes the _work/ intermediate-file convention without fixing output/", () => {
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "minutes-maid",
    });
    expect(text).toContain("_work/");
    expect(text).toMatch(/中間ファイル/);
    // 置き場はプロジェクトフォルダ直下に固定し、成果物フォルダの位置に依存させない
    expect(text).toMatch(/プロジェクトフォルダ直下の `_work\/`/);
    // 成果物の置き場としての output/ 固定はしない（例示のスキル相対パスは別）
    expect(text).not.toMatch(/成果物.*output\//);
  });

  it("ignores invalid assets declaration and falls back to scan", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-runtime-"));
    const skillDir = path.join(tmpDir, "skill");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html></html>",
    );

    // パーサが不正値を空配列にしたものとして渡す → スキャンにフォールバック
    const text = buildSkillRuntimeContext({
      projectFolderId: "demo",
      skillId: "any-skill",
      skillDirAbsolute: skillDir,
      skillAssets: [],
    });
    expect(text).toContain("references/base.html");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("drops declared asset paths that do not exist under the skill dir", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-runtime-"));
    const skillDir = path.join(tmpDir, "skill");
    fs.mkdirSync(path.join(skillDir, "references"), { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "references", "base.html"),
      "<html></html>",
    );

    const candidates = resolveSkillAssetCandidates(skillDir, [
      "references/base.html",
      "references/missing.css",
      "../escape.html",
    ]);
    expect(candidates.map((c) => c.relativePath)).toEqual([
      "references/base.html",
    ]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("scanSkillFrameCandidates", () => {
  it("scans only references/ and templates/ top-level with extension filter and limit", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-scan-"));
    const skillDir = path.join(tmpDir, "skill");
    fs.mkdirSync(path.join(skillDir, "references", "nested"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(skillDir, "templates"), { recursive: true });
    fs.mkdirSync(path.join(skillDir, "other"), { recursive: true });

    fs.writeFileSync(path.join(skillDir, "references", "a.html"), "a");
    fs.writeFileSync(path.join(skillDir, "references", "b.css"), "b");
    fs.writeFileSync(path.join(skillDir, "references", "c.svg"), "c");
    fs.writeFileSync(path.join(skillDir, "references", "skip.md"), "md");
    fs.writeFileSync(
      path.join(skillDir, "references", "nested", "deep.html"),
      "deep",
    );
    fs.writeFileSync(path.join(skillDir, "templates", "d.html"), "d");
    fs.writeFileSync(path.join(skillDir, "templates", "e.html"), "e");
    fs.writeFileSync(path.join(skillDir, "other", "f.html"), "f");

    const all = scanSkillFrameCandidates(skillDir, 20);
    expect(all.map((c) => c.relativePath)).toEqual([
      "references/a.html",
      "references/b.css",
      "references/c.svg",
      "templates/d.html",
      "templates/e.html",
    ]);

    const limited = scanSkillFrameCandidates(skillDir, FRAME_CANDIDATE_LIMIT);
    expect(limited).toHaveLength(FRAME_CANDIDATE_LIMIT);
    expect(limited.map((c) => c.relativePath)).toEqual(
      [
        "references/a.html",
        "references/b.css",
        "references/c.svg",
        "templates/d.html",
        "templates/e.html",
      ].slice(0, FRAME_CANDIDATE_LIMIT),
    );

    // 特定スキル名・特定ファイル名への分岐がないこと（汎用規則のみ）
    expect(scanSkillFrameCandidates.toString()).not.toMatch(
      /minutes-maid|creating-visual|base\.html/,
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("mergeSkillSystemPrompt", () => {
  it("prepends runtime context", () => {
    expect(mergeSkillSystemPrompt("SKILL", "RUNTIME")).toContain("RUNTIME");
    expect(mergeSkillSystemPrompt("SKILL", "RUNTIME")).toContain("SKILL");
    expect(mergeSkillSystemPrompt("SKILL", null)).toBe("SKILL");
  });
});

describe("isPathInsideProjectFolder", () => {
  it("accepts workspace prefix and relative paths", () => {
    expect(isPathInsideProjectFolder("workspace/demo/a.md", "demo")).toBe(true);
    expect(isPathInsideProjectFolder("sub/a.md", "demo")).toBe(true);
    expect(isPathInsideProjectFolder("workspace/other/a.md", "demo")).toBe(
      false,
    );
    expect(isPathInsideProjectFolder("~/Downloads/x.md", "demo")).toBe(false);
  });
});

describe("findOutsideProjectPathHints", () => {
  it("finds other project and home paths", () => {
    const hints = findOutsideProjectPathHints(
      "see workspace/other/file.md and ~/Downloads/a.md",
      "demo",
    );
    expect(hints.some((h) => h.includes("other"))).toBe(true);
    expect(hints.some((h) => h.includes("Downloads"))).toBe(true);
  });

  it("ignores in-project paths", () => {
    expect(
      findOutsideProjectPathHints("use @workspace/demo/notes.md", "demo"),
    ).toEqual([]);
  });
});

describe("listDefaultOutputDestinations", () => {
  it("puts same folder before project root", () => {
    const options = listDefaultOutputDestinations("demo", "sub/notes.md");
    expect(options.map((o) => o.id)).toEqual(["same-folder", "project-root"]);
    expect(options[0].relativeDir).toBe("sub");
  });

  it("dedupes when current file is at project root", () => {
    const options = listDefaultOutputDestinations("demo", "notes.md");
    expect(options).toHaveLength(1);
    expect(options[0].id).toBe("same-folder");
  });
});
