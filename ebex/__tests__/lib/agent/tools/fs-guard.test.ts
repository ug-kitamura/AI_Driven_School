import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveToolTargetPath } from "@/lib/agent/tools/fs-guard";
import { createFolder } from "@/lib/workspace-mutations";

describe("resolveToolTargetPath", () => {
  it("resolves project-relative paths inside the project folder", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    createFolder(tmpDir, "demo");
    const resolved = resolveToolTargetPath(tmpDir, "demo", "notes.md");
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe("workspace/demo/notes.md");
    expect(resolved.insideProject).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves workspace/ paths for other projects as outside project", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    createFolder(tmpDir, "demo");
    createFolder(tmpDir, "other");
    const resolved = resolveToolTargetPath(tmpDir, "demo", "workspace/other/notes.md");
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.relativePath).toBe("workspace/other/notes.md");
    expect(resolved.insideProject).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects parent traversal", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    const resolved = resolveToolTargetPath(tmpDir, "demo", "../secret.md");
    expect(resolved).toEqual({ error: "不正なパスです: ../secret.md" });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rejects absolute paths outside workspace", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-fs-guard-"));
    const resolved = resolveToolTargetPath(tmpDir, "demo", "C:/Windows/system.ini");
    expect("error" in resolved).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
