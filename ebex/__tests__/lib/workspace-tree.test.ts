import { describe, expect, it } from "vitest";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import {
  fileExistsInTree,
  filterWorkspaceTree,
  getAncestorFolderPaths,
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
});
