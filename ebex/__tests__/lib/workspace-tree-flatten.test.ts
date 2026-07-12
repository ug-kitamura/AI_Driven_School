import { describe, expect, it } from "vitest";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import {
  buildVisibleRows,
  emptyRowId,
  fileRowId,
  folderRowId,
  resolveHomeEndNavigation,
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

  it("collapses the parent folder for an empty placeholder row", () => {
    const result = resolveLeftNavigation(
      { id: emptyRowId("demo/sub"), kind: "empty", folderPath: "demo/sub", depth: 1 },
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
});

describe("resolveHomeEndNavigation", () => {
  const multiProjectTree: WorkspaceTreeNode[] = [
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
    {
      name: "other",
      path: "other",
      files: ["a.md"],
      children: [],
    },
  ];

  const expandedAll = {
    demo: true,
    "demo/sub": true,
    "demo/sub/empty": true,
    other: true,
  };

  function rowsOf(tree = multiProjectTree, expanded = expandedAll) {
    return buildVisibleRows(tree, expanded, new Set());
  }

  function indexOf(rows: ReturnType<typeof rowsOf>, id: string) {
    const index = rows.findIndex((row) => row.id === id);
    expect(index).toBeGreaterThanOrEqual(0);
    return index;
  }

  it("moves Home to the first sibling under the same parent", () => {
    const rows = rowsOf();
    const index = indexOf(rows, fileRowId("demo", "root.md"));
    expect(
      resolveHomeEndNavigation(rows, index, "Home", false),
    ).toEqual({ focusRowId: folderRowId("demo/sub") });
  });

  it("moves End to the last sibling under the same parent", () => {
    const rows = rowsOf();
    const index = indexOf(rows, folderRowId("demo/sub"));
    expect(
      resolveHomeEndNavigation(rows, index, "End", false),
    ).toEqual({ focusRowId: fileRowId("demo", "root.md") });
  });

  it("applies the sibling algorithm to empty placeholder rows", () => {
    const rows = rowsOf();
    const emptyIndex = indexOf(rows, emptyRowId("demo/sub/empty"));
    expect(
      resolveHomeEndNavigation(rows, emptyIndex, "Home", false),
    ).toEqual({ focusRowId: null });
    expect(
      resolveHomeEndNavigation(rows, emptyIndex, "End", false),
    ).toEqual({ focusRowId: null });

    const notesIndex = indexOf(rows, fileRowId("demo/sub", "notes.md"));
    expect(
      resolveHomeEndNavigation(rows, notesIndex, "Home", false),
    ).toEqual({ focusRowId: folderRowId("demo/sub/empty") });
  });

  it("is a no-op when already at the sibling edge", () => {
    const rows = rowsOf();
    const first = indexOf(rows, folderRowId("demo/sub"));
    expect(
      resolveHomeEndNavigation(rows, first, "Home", false),
    ).toEqual({ focusRowId: null });
  });

  it("treats project folders as siblings of each other", () => {
    const rows = rowsOf();
    const index = indexOf(rows, folderRowId("other"));
    expect(
      resolveHomeEndNavigation(rows, index, "Home", false),
    ).toEqual({ focusRowId: folderRowId("demo") });
    expect(
      resolveHomeEndNavigation(rows, index, "End", false),
    ).toEqual({ focusRowId: null });
  });

  it("moves Ctrl+Home to the first visible row", () => {
    const rows = rowsOf();
    const index = indexOf(rows, fileRowId("demo/sub", "notes.md"));
    expect(
      resolveHomeEndNavigation(rows, index, "Home", true),
    ).toEqual({ focusRowId: folderRowId("demo") });
  });

  it("moves Ctrl+End to the last visible row", () => {
    const rows = rowsOf();
    const index = indexOf(rows, folderRowId("demo"));
    expect(
      resolveHomeEndNavigation(rows, index, "End", true),
    ).toEqual({ focusRowId: fileRowId("other", "a.md") });
  });

  it("is a no-op for Ctrl+Home when already at the first row", () => {
    const rows = rowsOf();
    expect(
      resolveHomeEndNavigation(rows, 0, "Home", true),
    ).toEqual({ focusRowId: null });
  });
});
