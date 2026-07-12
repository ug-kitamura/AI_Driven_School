import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createFile,
  createFolder,
  createSubFolder,
} from "@/lib/workspace-mutations";
import { listFolderRelativePathsForNaming } from "@/lib/workspace-folder-path-list";
import { getWorkspaceDir } from "@/lib/workspace-paths";

describe("listFolderRelativePathsForNaming", () => {
  it("lists media and nested paths, excludes secrets and session.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-paths-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    createFile(tmpDir, "demo", "notes.md", "a");
    createFile(tmpDir, "demo", "recording.mp4", "binary");
    createFile(tmpDir, "demo/sub", "meeting.md", "b");
    createFile(tmpDir, "demo", "credentials.pem", "secret");
    fs.writeFileSync(
      path.join(getWorkspaceDir(tmpDir), "demo", "session.json"),
      "{}",
    );

    const paths = listFolderRelativePathsForNaming(tmpDir, "demo");
    expect(paths).toEqual([
      "notes.md",
      "recording.mp4",
      "sub/meeting.md",
    ]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty for empty folder", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-paths-"));
    createFolder(tmpDir, "empty");
    expect(listFolderRelativePathsForNaming(tmpDir, "empty")).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
