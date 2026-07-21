import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HOST_MARKER_FILENAME, getProjectRoot } from "@/lib/project-root";

/** `host/ebex/` 相当の擬似ツリーを作り、cwd を `ebex` 側に固定する。 */
function makeTree(options: { markerAt?: "host" | "grandparent" }): {
  host: string;
  appRoot: string;
} {
  const base = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "ebex-root-")),
  );
  const host = path.join(base, "host");
  const appRoot = path.join(host, "ebex");
  fs.mkdirSync(appRoot, { recursive: true });

  if (options.markerAt === "host") {
    fs.writeFileSync(path.join(host, HOST_MARKER_FILENAME), "");
  }
  if (options.markerAt === "grandparent") {
    fs.writeFileSync(path.join(base, HOST_MARKER_FILENAME), "");
  }
  return { host, appRoot };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getProjectRoot", () => {
  it("親に .ebex.host があれば親を projectRoot にする", () => {
    const { host, appRoot } = makeTree({ markerAt: "host" });
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    expect(getProjectRoot()).toBe(host);
  });

  it("マーカーが無ければ cwd 自身を projectRoot にする", () => {
    const { appRoot } = makeTree({});
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    expect(getProjectRoot()).toBe(appRoot);
  });

  it("祖先にしかマーカーが無い場合は遡らない", () => {
    const { appRoot } = makeTree({ markerAt: "grandparent" });
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    expect(getProjectRoot()).toBe(appRoot);
  });

  it("マーカーがディレクトリの場合はホストとみなさない", () => {
    const { host, appRoot } = makeTree({});
    fs.mkdirSync(path.join(host, HOST_MARKER_FILENAME));
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    expect(getProjectRoot()).toBe(appRoot);
  });

  it("環境変数では projectRoot を変えられない", () => {
    const { appRoot } = makeTree({});
    vi.stubEnv("EBEX_PROJECT_ROOT", path.join(appRoot, "..", "elsewhere"));
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    expect(getProjectRoot()).toBe(appRoot);
    vi.unstubAllEnvs();
  });

  it("解決は一度だけで、2 回目以降は fs を触らない", () => {
    const { host, appRoot } = makeTree({ markerAt: "host" });
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);
    const statSync = vi.spyOn(fs, "statSync");

    expect(getProjectRoot()).toBe(host);
    const afterFirst = statSync.mock.calls.length;
    expect(getProjectRoot()).toBe(host);
    expect(getProjectRoot()).toBe(host);

    expect(statSync.mock.calls.length).toBe(afterFirst);
  });

  it("起動後に追加されたマーカーは反映されない", () => {
    const { host, appRoot } = makeTree({});
    vi.spyOn(process, "cwd").mockReturnValue(appRoot);

    expect(getProjectRoot()).toBe(appRoot);
    fs.writeFileSync(path.join(host, HOST_MARKER_FILENAME), "");

    expect(getProjectRoot()).toBe(appRoot);
  });
});
