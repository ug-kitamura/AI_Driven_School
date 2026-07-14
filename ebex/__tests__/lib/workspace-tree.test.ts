import { describe, expect, it } from "vitest";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import {
  buildRenamedFolderPath,
  fileExistsInTree,
  filterWorkspaceTree,
  folderExistsInTree,
  getAncestorFolderPaths,
  getFolderBaseName,
  isEmptyFolderInTree,
  remapFolderPath,
} from "@/lib/workspace-tree";

const sampleTree: WorkspaceTreeNode[] = [
  {
    name: "demo",
    path: "demo",
    files: ["root.md"],
    children: [
      {
        name: "sub",
        path: "demo/sub",
        files: ["deep.md"],
        children: [],
      },
    ],
  },
];

describe("workspace-tree", () => {
  it("finds nested files", () => {
    expect(fileExistsInTree(sampleTree, "demo/sub", "deep.md")).toBe(true);
    expect(fileExistsInTree(sampleTree, "demo", "missing.md")).toBe(false);
  });

  it("detects empty folders in the tree", () => {
    const treeWithEmpty: WorkspaceTreeNode[] = [
      {
        name: "demo",
        path: "demo",
        files: ["root.md"],
        children: [
          {
            name: "empty",
            path: "demo/empty",
            files: [],
            children: [],
          },
        ],
      },
    ];
    expect(isEmptyFolderInTree(treeWithEmpty, "demo/empty")).toBe(true);
    expect(isEmptyFolderInTree(treeWithEmpty, "demo")).toBe(false);
    expect(isEmptyFolderInTree(treeWithEmpty, "missing")).toBe(false);
  });

  it("returns ancestor folder paths", () => {
    expect(getAncestorFolderPaths("demo/sub")).toEqual(["demo", "demo/sub"]);
  });

  it("filters nested tree by keyword", () => {
    const filtered = filterWorkspaceTree(sampleTree, "deep");
    expect(filtered[0]?.children[0]?.files).toContain("deep.md");
  });

  it("remaps folder paths after rename", () => {
    expect(remapFolderPath("demo/sub", "demo", "renamed")).toBe("renamed/sub");
  });

  it("checks folder existence in tree", () => {
    expect(folderExistsInTree(sampleTree, "demo")).toBe(true);
    expect(folderExistsInTree(sampleTree, "demo/sub")).toBe(true);
    expect(folderExistsInTree(sampleTree, "missing")).toBe(false);
  });

  it("extracts folder base name and builds renamed path", () => {
    expect(getFolderBaseName("demo/sub")).toBe("sub");
    expect(getFolderBaseName("demo")).toBe("demo");
    expect(buildRenamedFolderPath("demo/sub", "renamed-sub")).toBe(
      "demo/renamed-sub",
    );
    expect(buildRenamedFolderPath("demo", "renamed")).toBe("renamed");
  });
});
