import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AGENT_BUSY_FOLDER_ERROR,
  isAgentLockedProjectFolder,
  isProjectFolderAgentActive,
  markProjectFolderAgentActive,
  resetActiveProjectFoldersForTests,
} from "@/lib/agent/active-project-folders";
import {
  AGENT_PROJECT_FOLDER_MISSING_ERROR,
  checkProjectFolderExists,
} from "@/lib/agent/project-folder-guard";
import { createFolder } from "@/lib/workspace-mutations";

describe("active-project-folders", () => {
  beforeEach(() => {
    resetActiveProjectFoldersForTests();
  });

  it("tracks active project folders with release", () => {
    expect(isProjectFolderAgentActive("demo")).toBe(false);
    const release = markProjectFolderAgentActive("demo");
    expect(isProjectFolderAgentActive("demo")).toBe(true);
    release();
    expect(isProjectFolderAgentActive("demo")).toBe(false);
  });

  it("locks only the top-level project folder", () => {
    expect(isAgentLockedProjectFolder("demo", "demo")).toBe(true);
    expect(isAgentLockedProjectFolder("demo/sub", "demo")).toBe(false);
    expect(isAgentLockedProjectFolder("other", "demo")).toBe(false);
    expect(AGENT_BUSY_FOLDER_ERROR).toContain("Agent 実行中");
  });
});

describe("checkProjectFolderExists", () => {
  it("returns null when the folder exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-pf-"));
    createFolder(tmpDir, "demo");
    expect(checkProjectFolderExists(tmpDir, "demo")).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an error when the folder is missing", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-pf-"));
    const error = checkProjectFolderExists(tmpDir, "gone");
    expect(error).toContain(AGENT_PROJECT_FOLDER_MISSING_ERROR);
    expect(error).toContain("workspace/gone");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
