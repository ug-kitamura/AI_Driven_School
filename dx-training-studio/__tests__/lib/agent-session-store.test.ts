import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createInitialStorage } from "@/lib/agent-chat-storage";
import {
  readLessonSessionFile,
  writeLessonSessionFile,
} from "@/lib/agent-session-store";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

describe("agent-session-store", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-session-store-"));
    writeFile(
      path.join(tmpDir, "contents", "S", "C", "L", LESSON_CONTENTS_FILENAME),
      "# L\n",
    );
    writeFile(
      path.join(tmpDir, "contents", "S", ".meta.json"),
      JSON.stringify({ order: ["C"] }),
    );
    writeFile(
      path.join(tmpDir, "contents", "S", "C", ".meta.json"),
      JSON.stringify({ order: ["L"] }),
    );
    writeFile(
      path.join(tmpDir, "contents", ".meta.json"),
      JSON.stringify({ order: ["S"] }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads session.json for a lesson", () => {
    const lessonId = "lesson-S-C-L";
    const storage = createInitialStorage();
    writeLessonSessionFile(tmpDir, lessonId, storage);
    const loaded = readLessonSessionFile(tmpDir, lessonId);
    expect(loaded?.activeSessionId).toBe(storage.activeSessionId);
    expect(
      fs.existsSync(path.join(tmpDir, "contents", "S", "C", "L", "session.json")),
    ).toBe(true);
  });
});
