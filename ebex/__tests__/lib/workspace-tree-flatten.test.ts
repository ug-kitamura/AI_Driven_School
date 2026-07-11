import { describe, expect, it } from "vitest";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import {
  buildVisibleRows,
  emptyRowId,
  fileRowId,
  folderRowId,
  resolveLeftNavigation,
  resolvePasteTarget,
  resolveSelectedFileRowId,
} from "@/lib/workspace-tree-flatten";

const sampleTree: WorkspaceTreeNode[] = [
  {
    name: "demo",
    path: "demo",
    files: ["root.md"],
    children: [
      {
        name: "sub",
        path: "demo/sub",
        files: ["notes.md"],
        children: [
          {
            name: "empty",
            path: "demo/sub/empty",
            files: [],
            children: [],
          },
        ],
      },
    ],
  },
];

describe("buildVisibleRows", () => {
  it("lists collapsed folders only", () => {
    const rows = buildVisibleRows(sampleTree, {}, new Set());
    expect(rows.map((r) => r.id)).toEqual([folderRowId("demo")]);
  });

  it("includes files and empty placeholder when expanded", () => {
    const expanded = {
      demo: true,
      "demo/sub": true,
      "demo/sub/empty": true,
    };
    const rows = buildVisibleRows(sampleTree, expanded, new Set());
    expect(rows.map((r) => r.id)).toEqual([
      folderRowId("demo"),
      folderRowId("demo/sub"),
      folderRowId("demo/sub/empty"),
      emptyRowId("demo/sub/empty"),
      fileRowId("demo/sub", "notes.md"),
      fileRowId("demo", "root.md"),
    ]);
  });

  it("auto-expands emphasized ancestor folders", () => {
    const rows = buildVisibleRows(
      sampleTree,
      {},
      new Set(["demo", "demo/sub"]),
    );
    expect(rows.some((r) => r.id === fileRowId("demo/sub", "notes.md"))).toBe(
      true,
    );
  });
});

describe("resolvePasteTarget", () => {
  it("returns parent folder path for file rows", () => {
    expect(
      resolvePasteTarget({
        id: fileRowId("demo/sub", "notes.md"),
        kind: "file",
        folderPath: "demo/sub",
        fileName: "notes.md",
        depth: 2,
      }),
    ).toBe("demo/sub");
  });
});

describe("resolveSelectedFileRowId", () => {
  it("returns the file row id when both folder and file are set", () => {
    expect(resolveSelectedFileRowId("demo/sub", "notes.md")).toBe(
      fileRowId("demo/sub", "notes.md"),
    );
  });

  it("returns null when no file is selected", () => {
    expect(resolveSelectedFileRowId("demo/sub", "")).toBeNull();
    expect(resolveSelectedFileRowId("", "")).toBeNull();
  });
});

describe("resolveLeftNavigation", () => {
  const isProjectFolder = (folderPath: string) => !folderPath.includes("/");
  const getParentFolderPath = (folderPath: string) => {
    const slash = folderPath.lastIndexOf("/");
    return slash < 0 ? null : folderPath.slice(0, slash);
  };

  it("collapses an expanded folder and keeps focus on itself", () => {
    const result = resolveLeftNavigation(
      { id: folderRowId("demo/sub"), kind: "folder", folderPath: "demo/sub", depth: 1 },
      {
        isFolderExpanded: () => true,
        isProjectFolder,
        getParentFolderPath,
      },
    );
    expect(result).toEqual({
      collapsePaths: ["demo/sub"],
      focusRowId: folderRowId("demo/sub"),
    });
  });

  it("is a no-op on a collapsed project folder", () => {
    const result = resolveLeftNavigation(
      { id: folderRowId("demo"), kind: "folder", folderPath: "demo", depth: 0 },
      {
        isFolderExpanded: () => false,
        isProjectFolder,
        getParentFolderPath,
      },
    );
    expect(result).toEqual({ collapsePaths: [], focusRowId: null });
  });

  it("moves focus to the parent and collapses it for a collapsed subfolder", () => {
    const result = resolveLeftNavigation(
      {
        id: folderRowId("demo/sub"),
        kind: "folder",
        folderPath: "demo/sub",
        depth: 1,
      },
      {
        isFolderExpanded: () => false,
        isProjectFolder,
        getParentFolderPath,
      },
    );
    expect(result).toEqual({
      collapsePaths: ["demo"],
      focusRowId: folderRowId("demo"),
    });
  });

  it("collapses the parent folder for a file row", () => {
    const result = resolveLeftNavigation(
      {
        id: fileRowId("demo/sub", "notes.md"),
        kind: "file",
        folderPath: "demo/sub",
        fileName: "notes.md",
        depth: 2,
      },
      {
        isFolderExpanded: () => false,
        isProjectFolder,
        getParentFolderPath,
      },
    );
    expect(result).toEqual({
      collapsePaths: ["demo/sub"],
      focusRowId: folderRowId("demo/sub"),
    });
  });

  it("returns null for the empty placeholder row", () => {
    const result = resolveLeftNavigation(
      { id: emptyRowId("demo/sub"), kind: "empty", folderPath: "demo/sub", depth: 1 },
      {
        isFolderExpanded: () => false,
        isProjectFolder,
        getParentFolderPath,
      },
    );
    expect(result).toBeNull();
  });
});
