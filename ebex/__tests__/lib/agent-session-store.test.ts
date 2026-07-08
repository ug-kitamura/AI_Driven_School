import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readFolderSessionFile,
  writeFolderSessionFile,
} from "@/lib/agent-session-store";
import { createInitialStorage } from "@/lib/agent-chat-storage";
import { createFolder } from "@/lib/workspace-mutations";

describe("agent-session-store", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("writes and reads session.json for a folder", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ebex-session-"));
    createFolder(tmpDir, "demo");
    const storage = createInitialStorage();
    writeFolderSessionFile(tmpDir, "demo", storage);
    const loaded = readFolderSessionFile(tmpDir, "demo");
    expect(loaded?.activeSessionId).toBe(storage.activeSessionId);
  });
});
