import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceSync } from "@/components/workspace/hooks/use-workspace-sync";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";

const POLL_MS = 3000;

const FOLDERS: WorkspaceTreeNode[] = [
  { name: "demo", path: "demo", files: ["a.md", "b.png"], children: [] },
];

type FetchState = {
  fingerprint: string;
  content: string;
  folders: WorkspaceTreeNode[];
  readFileCalls: number;
};

let state: FetchState;

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input.startsWith("/api/workspace/mtime")) {
        return {
          ok: true,
          json: async () => ({ mtime: 1, fingerprint: state.fingerprint }),
        };
      }
      if (input.startsWith("/api/workspace/load")) {
        return { ok: true, json: async () => ({ folders: state.folders }) };
      }
      if (input.startsWith("/api/workspace/read-file")) {
        state.readFileCalls += 1;
        return { ok: true, json: async () => ({ content: state.content }) };
      }
      throw new Error(`unexpected fetch: ${input}`);
    }),
  );
}

/** ポーリング 1 周分を進め、fetch チェーンの解決も待つ。 */
async function tick() {
  await act(async () => {
    vi.advanceTimersByTime(POLL_MS);
    await vi.runAllTicks();
    // fetch チェーンが複数段あるのでマイクロタスクを十分に流す
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

function setup(
  overrides: Partial<Parameters<typeof useWorkspaceSync>[0]> = {},
) {
  const onSelectedFileContentLoaded = vi.fn();
  const onFoldersLoaded = vi.fn();
  const onSelectionChange = vi.fn();

  const initialProps = {
    folders: FOLDERS,
    selectedFolderPath: "demo",
    selectedFileName: "a.md",
    pendingSave: false,
    onFoldersLoaded,
    onSelectionChange,
    onSelectedFileContentLoaded,
    ...overrides,
  };

  const view = renderHook(
    (props: typeof initialProps) => useWorkspaceSync(props),
    {
      initialProps,
    },
  );

  return {
    view,
    onSelectedFileContentLoaded,
    onFoldersLoaded,
    onSelectionChange,
  };
}

describe("useWorkspaceSync — 選択中ファイルの本文同期", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state = {
      fingerprint: "fp-1",
      content: "updated body",
      folders: FOLDERS,
      readFileCalls: 0,
    };
    installFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fingerprint が変化したら選択中ファイルの本文を読み直して通知する", async () => {
    const { onSelectedFileContentLoaded } = setup();

    // 初回は fingerprint を記録するだけ
    await tick();
    expect(onSelectedFileContentLoaded).not.toHaveBeenCalled();

    state.fingerprint = "fp-2";
    await tick();

    expect(onSelectedFileContentLoaded).toHaveBeenCalledWith("updated body");
  });

  it("fingerprint が変わらなければ本文を読み直さない", async () => {
    const { onSelectedFileContentLoaded } = setup();

    await tick();
    await tick();

    expect(state.readFileCalls).toBe(0);
    expect(onSelectedFileContentLoaded).not.toHaveBeenCalled();
  });

  it("保存待ち（pendingSave）のあいだは本文を読み直さない", async () => {
    const { view, onSelectedFileContentLoaded } = setup();

    await tick();
    view.rerender({
      folders: FOLDERS,
      selectedFolderPath: "demo",
      selectedFileName: "a.md",
      pendingSave: true,
      onFoldersLoaded: vi.fn(),
      onSelectionChange: vi.fn(),
      onSelectedFileContentLoaded,
    });

    state.fingerprint = "fp-2";
    await tick();

    expect(state.readFileCalls).toBe(0);
    expect(onSelectedFileContentLoaded).not.toHaveBeenCalled();
  });

  it("閲覧専用ファイル（画像）では本文を読み直さない", async () => {
    const { onSelectedFileContentLoaded } = setup({
      selectedFileName: "b.png",
    });

    await tick();
    state.fingerprint = "fp-2";
    await tick();

    expect(state.readFileCalls).toBe(0);
    expect(onSelectedFileContentLoaded).not.toHaveBeenCalled();
  });

  it("no file 選択では本文を読み直さない", async () => {
    const { onSelectedFileContentLoaded } = setup({
      selectedFileName: "no file",
    });

    await tick();
    state.fingerprint = "fp-2";
    await tick();

    expect(state.readFileCalls).toBe(0);
    expect(onSelectedFileContentLoaded).not.toHaveBeenCalled();
  });

  it("選択が変わる場合は選択変更側に任せ、本文を二重取得しない", async () => {
    const { onSelectedFileContentLoaded, onSelectionChange } = setup();

    await tick();
    // 選択中ファイルが外部で消えた → 選択が別ファイルへ移る
    state.folders = [
      { name: "demo", path: "demo", files: ["c.md"], children: [] },
    ];
    state.fingerprint = "fp-2";
    await tick();

    expect(onSelectionChange).toHaveBeenCalledWith({
      folderPath: "demo",
      fileName: "c.md",
    });
    expect(state.readFileCalls).toBe(0);
    expect(onSelectedFileContentLoaded).not.toHaveBeenCalled();
  });

  it("ポーリング間隔より短い周期で再描画が続いても同期が止まらない", async () => {
    const { view, onSelectedFileContentLoaded } = setup();

    // 初回の fingerprint を記録させる
    await tick();
    state.fingerprint = "fp-2";

    // 実際の Workspace は onSelectionChange をインライン関数で渡すため、
    // 再描画のたびにコールバックの identity が変わる。これを依存配列に入れて
    // いると、再描画のたびに interval が張り直されて 3 秒に到達できず、
    // AI がファイルを書いている最中（＝再描画が多い時間帯）に同期が止まる。
    // 2 秒経過 → 再描画 → 2 秒経過、で合計 4 秒。interval が安定していれば
    // 3 秒の時点で 1 回発火する。
    const rerenderWithNewCallbacks = () =>
      view.rerender({
        folders: FOLDERS,
        selectedFolderPath: "demo",
        selectedFileName: "a.md",
        pendingSave: false,
        onFoldersLoaded: vi.fn(),
        onSelectionChange: vi.fn(),
        onSelectedFileContentLoaded,
      });

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        vi.advanceTimersByTime(2000);
        for (let j = 0; j < 10; j++) await Promise.resolve();
      });
      rerenderWithNewCallbacks();
    }

    await act(async () => {
      for (let j = 0; j < 10; j++) await Promise.resolve();
    });

    expect(onSelectedFileContentLoaded).toHaveBeenCalledWith("updated body");
  });
});
