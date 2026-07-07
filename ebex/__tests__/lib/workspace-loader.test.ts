import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadWorkspace } from "@/lib/workspace-loader";
import { createFile, createFolder, createSubFolder } from "@/lib/workspace-mutations";

describe("workspace-loader", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("loads nested folders recursively", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-loader-"));
    createFolder(tmpDir, "demo");
    createSubFolder(tmpDir, "demo", "sub");
    createFile(tmpDir, "demo/sub", "deep.md", "# nested");

    const loaded = loadWorkspace(tmpDir);
    expect(loaded.folders).toHaveLength(1);
    expect(loaded.folders[0]?.path).toBe("demo");
    expect(loaded.folders[0]?.children).toHaveLength(1);
    expect(loaded.folders[0]?.children[0]?.path).toBe("demo/sub");
    expect(loaded.folders[0]?.children[0]?.files).toContain("deep.md");
    expect(loaded.folders[0]?.children[0]?.files).not.toContain("session.json");
  });
});
