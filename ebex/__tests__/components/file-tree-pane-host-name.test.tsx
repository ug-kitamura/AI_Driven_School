import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FileTreePane } from "@/components/workspace/FileTreePane";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";

// 静的 png インポートは vitest では文字列になり、next/image の width 検証に落ちる。
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- テスト用スタブ
    <img src={typeof src === "string" ? src : ""} alt={alt} />
  ),
}));

const FOLDERS: WorkspaceTreeNode[] = [
  { name: "proj-a", path: "proj-a", files: ["a.md"], children: [] },
];

function renderPane(hostName: string | null, onOpenPurpose = vi.fn()) {
  render(
    <FileTreePane
      folders={FOLDERS}
      hostName={hostName}
      selectedFolderPath="proj-a"
      selectedFileName="a.md"
      onSelectFile={vi.fn()}
      onRefresh={vi.fn().mockResolvedValue(undefined)}
      onOpenPurpose={onOpenPurpose}
    />,
  );
  return { onOpenPurpose };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Pane 1 ヘッダーのホスト表示", () => {
  it("ホスト配下では for {name} を表示する", () => {
    renderPane("dx-training-studio");

    expect(screen.getByText("for dx-training-studio")).toBeTruthy();
  });

  it("単体起動では接尾辞を表示しない", () => {
    renderPane(null);

    expect(screen.getByText("EBEX")).toBeTruthy();
    expect(screen.queryByText(/^for /)).toBeNull();
  });

  it("接尾辞はグレーの小さい文字で、ツールチップを持たない", () => {
    renderPane("dx-training-studio");
    const suffix = screen.getByText("for dx-training-studio");

    expect(suffix.className).toContain("text-xs");
    expect(suffix.className).toContain("text-muted-foreground");
    expect(suffix.className).toContain("truncate");
    expect(suffix.getAttribute("title")).toBeNull();
  });

  it("接尾辞は Purpose ボタンの外側にあり、クリックしても開かない", () => {
    const { onOpenPurpose } = renderPane("dx-training-studio");
    const suffix = screen.getByText("for dx-training-studio");

    expect(suffix.closest("button")).toBeNull();
    fireEvent.click(suffix);
    expect(onOpenPurpose).not.toHaveBeenCalled();
  });

  it("ロゴと EBEX のクリックでは Purpose が開く", () => {
    const { onOpenPurpose } = renderPane("dx-training-studio");

    fireEvent.click(screen.getByRole("button", { name: "EBE Purpose を開く" }));
    expect(onOpenPurpose).toHaveBeenCalledTimes(1);
  });
});
