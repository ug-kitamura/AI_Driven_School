import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { executeRegisteredTool } from "@/lib/agent/tools/registry";
import { createFile, createFolder } from "@/lib/workspace-mutations";
import { getWorkspaceDir } from "@/lib/workspace-paths";

/**
 * minutes-maid 相当の read → write フローを API なしで通し試験する。
 */
describe("minutes-maid-like file flow", () => {
  it("reads VTT and writes HTML output", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-minutes-"));
    createFolder(tmpDir, "20260712-minutes");
    const vtt = [
      "WEBVTT",
      "",
      "00:00:01.000 --> 00:00:05.000",
      "議題: 月次定例",
    ].join("\n");
    createFile(tmpDir, "20260712-minutes", "meeting.vtt", vtt);

    const context = {
      projectRoot: tmpDir,
      projectFolderId: "20260712-minutes",
    };
    const readOutcome = await executeRegisteredTool(
      "read_file",
      { path: "meeting.vtt" },
      context,
    );
    expect(readOutcome.result).toMatchObject({
      path: "workspace/20260712-minutes/meeting.vtt",
      content: expect.stringContaining("WEBVTT"),
    });

    const html = "<!DOCTYPE html><html><body><h1>議事録</h1></body></html>";
    const writeOutcome = await executeRegisteredTool(
      "write_file",
      { path: "output/minutes.html", content: html },
      context,
    );
    expect(writeOutcome.result).toEqual({
      path: "workspace/20260712-minutes/output/minutes.html",
      bytes: Buffer.byteLength(html, "utf-8"),
    });

    const written = fs.readFileSync(
      path.join(
        getWorkspaceDir(tmpDir),
        "20260712-minutes",
        "output",
        "minutes.html",
      ),
      "utf-8",
    );
    expect(written).toBe(html);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
