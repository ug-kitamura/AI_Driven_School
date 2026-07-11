import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/workspace/create-folder/route";
import { getWorkspaceDir } from "@/lib/workspace-paths";

describe("POST /api/workspace/create-folder", () => {
  let tmpDir: string;
  let previousCwd: string;

  afterEach(() => {
    process.chdir(previousCwd);
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates a subfolder when parentPath is provided", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-create-folder-"));
    previousCwd = process.cwd();
    process.chdir(tmpDir);

    const parentPath = "parent";
    fs.mkdirSync(path.join(getWorkspaceDir(tmpDir), parentPath), {
      recursive: true,
    });

    const response = await POST(
      new Request("http://localhost/api/workspace/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath, name: "child" }),
      }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { path?: string };
    expect(data.path).toBe("parent/child");
    expect(
      fs.existsSync(path.join(getWorkspaceDir(tmpDir), "parent", "child")),
    ).toBe(true);
    expect(fs.existsSync(path.join(getWorkspaceDir(tmpDir), "child"))).toBe(
      false,
    );
  });
});
