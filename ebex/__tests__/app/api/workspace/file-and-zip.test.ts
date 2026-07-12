import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { GET as getFile } from "@/app/api/workspace/file/route";
import { GET as getZipEntries } from "@/app/api/workspace/zip-entries/route";
import { getWorkspaceDir } from "@/lib/workspace-paths";

describe("GET /api/workspace/file", () => {
  let tmpDir: string;
  let previousCwd: string;

  afterEach(() => {
    process.chdir(previousCwd);
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("serves image bytes with content-type", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-file-api-"));
    previousCwd = process.cwd();
    process.chdir(tmpDir);

    const folder = "demo";
    const dir = path.join(getWorkspaceDir(tmpDir), folder);
    fs.mkdirSync(dir, { recursive: true });
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    fs.writeFileSync(path.join(dir, "pic.png"), png);

    const res = await getFile(
      new Request(
        "http://localhost/api/workspace/file?folderId=demo&fileName=pic.png",
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.equals(png)).toBe(true);
  });

  it("rejects path traversal in folderId", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-file-trav-"));
    previousCwd = process.cwd();
    process.chdir(tmpDir);
    fs.mkdirSync(getWorkspaceDir(tmpDir), { recursive: true });

    const res = await getFile(
      new Request(
        "http://localhost/api/workspace/file?folderId=../secret&fileName=pic.png",
      ),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("GET /api/workspace/zip-entries", () => {
  let tmpDir: string;
  let previousCwd: string;

  afterEach(() => {
    process.chdir(previousCwd);
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("lists zip entry paths", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-zip-api-"));
    previousCwd = process.cwd();
    process.chdir(tmpDir);

    const folder = "demo";
    const dir = path.join(getWorkspaceDir(tmpDir), folder);
    fs.mkdirSync(dir, { recursive: true });

    const zip = new JSZip();
    zip.file("a.txt", "hello");
    zip.file("nested/b.txt", "world");
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(path.join(dir, "pack.zip"), buf);

    const res = await getZipEntries(
      new Request(
        "http://localhost/api/workspace/zip-entries?folderId=demo&fileName=pack.zip",
      ),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      entries: Array<{ path: string }>;
      truncated: boolean;
    };
    expect(data.entries.map((e) => e.path)).toEqual(["a.txt", "nested/b.txt"]);
    expect(data.truncated).toBe(false);
  });
});
