import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createFile,
  createFolder,
  createSubFolder,
} from "@/lib/workspace-mutations";
import {
  excerptDepthForRelativePath,
  excerptTierForFileName,
  listFolderTextExcerptsForNaming,
} from "@/lib/workspace-folder-text-excerpts";
import { getWorkspaceDir } from "@/lib/workspace-paths";

describe("excerptTierForFileName", () => {
  it("ranks readme before other md/txt", () => {
    expect(excerptTierForFileName("README.md")).toBe(0);
    expect(excerptTierForFileName("readme.txt")).toBe(0);
    expect(excerptTierForFileName("notes.md")).toBe(1);
    expect(excerptTierForFileName("memo.txt")).toBe(2);
  });
});

describe("excerptDepthForRelativePath", () => {
  it("counts slash depth", () => {
    expect(excerptDepthForRelativePath("notes.md")).toBe(0);
    expect(excerptDepthForRelativePath("docs/README.md")).toBe(1);
    expect(excerptDepthForRelativePath("a/b/c.md")).toBe(2);
  });
});

describe("listFolderTextExcerptsForNaming", () => {
  it("orders by depth, then readme → md → txt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-excerpt-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "docs");
    createFile(tmpDir, "demo", "memo.txt", "root txt");
    createFile(tmpDir, "demo", "README.md", "root readme");
    createFile(tmpDir, "demo/docs", "notes.md", "nested md");
    createFile(tmpDir, "demo/docs", "README.md", "nested readme");

    const excerpts = listFolderTextExcerptsForNaming(tmpDir, "demo");
    expect(excerpts.map((e) => e.relativePath)).toEqual([
      "README.md",
      "memo.txt",
      "docs/README.md",
      "docs/notes.md",
    ]);
    expect(excerpts[0]?.content).toContain("root readme");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("excludes node_modules, .next, dot dirs, secrets, and non-text", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-excerpt-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "notes.md", "keep me");
    createFile(tmpDir, "demo", "photo.png", "img");
    createFile(tmpDir, "demo", "credentials.pem", "secret");

    const demoAbs = path.join(getWorkspaceDir(tmpDir), "demo");
    fs.mkdirSync(path.join(demoAbs, "node_modules", "pkg"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(demoAbs, "node_modules", "pkg", "README.md"),
      "dep readme",
    );
    fs.mkdirSync(path.join(demoAbs, ".next"), { recursive: true });
    fs.writeFileSync(path.join(demoAbs, ".next", "notes.md"), "build");
    fs.mkdirSync(path.join(demoAbs, ".hidden"), { recursive: true });
    fs.writeFileSync(path.join(demoAbs, ".hidden", "secret.md"), "hidden");
    fs.writeFileSync(path.join(demoAbs, ".dot.md"), "dotfile");

    const excerpts = listFolderTextExcerptsForNaming(tmpDir, "demo");
    expect(excerpts.map((e) => e.relativePath)).toEqual(["notes.md"]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when only excluded text exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-excerpt-"));
    createFolder(tmpDir, "demo");
    const demoAbs = path.join(getWorkspaceDir(tmpDir), "demo");
    fs.mkdirSync(path.join(demoAbs, "node_modules", "pkg"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(demoAbs, "node_modules", "pkg", "README.md"),
      "dep",
    );

    expect(listFolderTextExcerptsForNaming(tmpDir, "demo")).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("respects max files and chars", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-excerpt-"));
    createFolder(tmpDir, "demo");
    createFile(tmpDir, "demo", "a.md", "AAAA");
    createFile(tmpDir, "demo", "b.md", "BBBB");
    createFile(tmpDir, "demo", "c.md", "CCCC");

    const limitedFiles = listFolderTextExcerptsForNaming(tmpDir, "demo", {
      maxFiles: 2,
    });
    expect(limitedFiles.map((e) => e.relativePath)).toEqual(["a.md", "b.md"]);

    const limitedChars = listFolderTextExcerptsForNaming(tmpDir, "demo", {
      maxChars: 4,
    });
    expect(limitedChars).toHaveLength(1);
    expect(limitedChars[0]?.content).toBe("AAAA");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("takes only the first maxLines", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-excerpt-"));
    createFolder(tmpDir, "demo");
    const manyLines = Array.from({ length: 150 }, (_, i) => `line-${i}`).join(
      "\n",
    );
    createFile(tmpDir, "demo", "long.md", manyLines);

    const onlyLong = listFolderTextExcerptsForNaming(tmpDir, "demo", {
      maxLines: 100,
    });
    expect(onlyLong).toHaveLength(1);
    expect(onlyLong[0]?.content.split(/\r?\n/).length).toBe(100);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads nested docs when root has no text", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-excerpt-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "docs");
    createFile(tmpDir, "demo", "photo.png", "img");
    createFile(tmpDir, "demo/docs", "README.md", "# kickoff");

    const excerpts = listFolderTextExcerptsForNaming(tmpDir, "demo");
    expect(excerpts.map((e) => e.relativePath)).toEqual(["docs/README.md"]);
    expect(excerpts[0]?.content).toContain("kickoff");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
