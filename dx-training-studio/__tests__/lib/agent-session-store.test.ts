import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  readScopeSessionFile,
  writeScopeSessionFile,
} from "@/lib/agent-session-store";
import { createInitialStorage } from "@/lib/agent-chat-storage";

const SERIES = "シリーズA";
const COURSE = "コースB";
const LESSON = "レッスンC";

function makeContents(root: string, ...segments: string[]): string {
  const dir = path.join(root, "contents", ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe("agent-session-store", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("レッスンスコープを contents 配下の session.json に書く", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    const lessonDir = makeContents(tmpDir, SERIES, COURSE, LESSON);
    const storage = createInitialStorage();
    const scope = { series: SERIES, course: COURSE, lesson: LESSON };

    writeScopeSessionFile(tmpDir, scope, storage);

    expect(fs.existsSync(path.join(lessonDir, "session.json"))).toBe(true);
    expect(readScopeSessionFile(tmpDir, scope)?.activeSessionId).toBe(
      storage.activeSessionId,
    );
  });

  it("コーススコープとレッスンスコープは別ファイルになる", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    makeContents(tmpDir, SERIES, COURSE, LESSON);
    const courseScope = { series: SERIES, course: COURSE };
    const lessonScope = { series: SERIES, course: COURSE, lesson: LESSON };

    const courseStorage = createInitialStorage();
    const lessonStorage = createInitialStorage();
    writeScopeSessionFile(tmpDir, courseScope, courseStorage);
    writeScopeSessionFile(tmpDir, lessonScope, lessonStorage);

    expect(readScopeSessionFile(tmpDir, courseScope)?.activeSessionId).toBe(
      courseStorage.activeSessionId,
    );
    expect(readScopeSessionFile(tmpDir, lessonScope)?.activeSessionId).toBe(
      lessonStorage.activeSessionId,
    );
    expect(courseStorage.activeSessionId).not.toBe(
      lessonStorage.activeSessionId,
    );
  });

  it("シリーズスコープを contents/<シリーズ>/session.json に書く", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    const seriesDir = makeContents(tmpDir, SERIES);
    const scope = { series: SERIES };

    writeScopeSessionFile(tmpDir, scope, createInitialStorage());

    expect(fs.existsSync(path.join(seriesDir, "session.json"))).toBe(true);
  });

  it("シリーズ 0 件でも contents 直下に書ける", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    const storage = createInitialStorage();

    writeScopeSessionFile(tmpDir, {}, storage);

    expect(fs.existsSync(path.join(tmpDir, "contents", "session.json"))).toBe(
      true,
    );
    expect(readScopeSessionFile(tmpDir, {})?.activeSessionId).toBe(
      storage.activeSessionId,
    );
  });

  it("フォルダをリネームしても session.json が一緒に移動するため履歴が残る", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    makeContents(tmpDir, SERIES, COURSE, LESSON);
    const storage = createInitialStorage();
    writeScopeSessionFile(
      tmpDir,
      { series: SERIES, course: COURSE, lesson: LESSON },
      storage,
    );

    // ディスク上のリネーム（session.json はフォルダの中にあるので付いてくる）
    const courseDir = path.join(tmpDir, "contents", SERIES, COURSE);
    fs.renameSync(path.join(courseDir, LESSON), path.join(courseDir, "改名後"));

    const loaded = readScopeSessionFile(tmpDir, {
      series: SERIES,
      course: COURSE,
      lesson: "改名後",
    });
    expect(loaded?.activeSessionId).toBe(storage.activeSessionId);
  });

  it("存在しないスコープの読み取りは null を返す", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    expect(readScopeSessionFile(tmpDir, { series: "無い" })).toBeNull();
  });

  it("コンテンツのディレクトリが無い場合は書き込まず Scope not found を投げる", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dx-session-"));
    expect(() =>
      writeScopeSessionFile(tmpDir, { series: "無い" }, createInitialStorage()),
    ).toThrow(/Scope not found/);
  });
});
