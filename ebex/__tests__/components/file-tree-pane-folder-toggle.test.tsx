import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { FileTreePane } from "@/components/workspace/FileTreePane";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";

// 静的 png インポートは vitest では文字列になり、next/image の width 検証に落ちる。
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- テスト用スタブ
    <img src={typeof src === "string" ? src : ""} alt={alt} />
  ),
}));

// proj-a は選択中フォルダなので既定で展開、proj-b は既定で折りたたみ。
const FOLDERS: WorkspaceTreeNode[] = [
  { name: "proj-a", path: "proj-a", files: ["a.md"], children: [] },
  { name: "proj-b", path: "proj-b", files: ["b.md"], children: [] },
];

function renderPane() {
  const onSelectFile = vi.fn();
  render(
    <FileTreePane
      folders={FOLDERS}
      hostName={null}
      selectedFolderPath="proj-a"
      selectedFileName="a.md"
      onSelectFile={onSelectFile}
      onRefresh={vi.fn().mockResolvedValue(undefined)}
      onOpenPurpose={vi.fn()}
    />,
  );
  return { onSelectFile };
}

function folderRow(name: string): HTMLElement {
  const row = screen.getByText(name).closest("[data-row-id]");
  if (!(row instanceof HTMLElement)) {
    throw new Error(`フォルダ行が見つからない: ${name}`);
  }
  return row;
}

function isExpanded(name: string): boolean {
  return folderRow(name).getAttribute("aria-expanded") === "true";
}

function isFocusedRow(row: HTMLElement): boolean {
  return row.className.split(" ").includes("bg-workspace-tree-row");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Pane 1 フォルダ行のシングルクリック開閉", () => {
  it("折りたたまれたフォルダ行を1回クリックすると展開する", () => {
    renderPane();
    expect(isExpanded("proj-b")).toBe(false);

    fireEvent.click(folderRow("proj-b"));

    expect(isExpanded("proj-b")).toBe(true);
    expect(screen.getByText("b.md")).toBeTruthy();
  });

  it("展開済みのフォルダ行を1回クリックすると折りたたむ", () => {
    renderPane();
    expect(isExpanded("proj-a")).toBe(true);

    fireEvent.click(folderRow("proj-a"));

    expect(isExpanded("proj-a")).toBe(false);
    expect(screen.queryByText("a.md")).toBeNull();
  });

  it("クリックしたフォルダ行がカーソル位置になる", () => {
    renderPane();

    fireEvent.click(folderRow("proj-b"));

    expect(isFocusedRow(folderRow("proj-b"))).toBe(true);
    expect(isFocusedRow(folderRow("proj-a"))).toBe(false);
  });

  it("フォルダ行のクリックでファイル選択は変化しない", () => {
    const { onSelectFile } = renderPane();

    fireEvent.click(folderRow("proj-b"));

    expect(onSelectFile).not.toHaveBeenCalled();
  });

  it("chevron を1回クリックしても開閉は1回だけ切り替わる", () => {
    renderPane();
    const chevron = within(folderRow("proj-b")).getByRole("button", {
      name: "展開する",
    });

    fireEvent.click(chevron);

    expect(isExpanded("proj-b")).toBe(true);
  });

  it("2回続けてクリックすると元の展開状態に戻る", () => {
    renderPane();
    const before = isExpanded("proj-b");

    fireEvent.click(folderRow("proj-b"));
    fireEvent.click(folderRow("proj-b"));

    expect(isExpanded("proj-b")).toBe(before);
  });
});
