import { describe, expect, it } from "vitest";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import {
  buildVisibleRows,
  emptyRowId,
  fileRowId,
  folderRowId,
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
