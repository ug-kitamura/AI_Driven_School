import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveConfirmRequirement } from "@/lib/agent/tools/confirm-gate";
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
});
