import type { WorkspaceTreeNode } from "@/lib/workspace-loader";

export type TreeRowKind = "folder" | "file" | "empty";

export type TreeRow = {
  id: string;
  kind: TreeRowKind;
  folderPath: string;
  fileName?: string;
  depth: number;
};

export function folderRowId(folderPath: string): string {
  return `folder:${folderPath}`;
}

export function fileRowId(folderPath: string, fileName: string): string {
  return `file:${folderPath}/${fileName}`;
}

export function emptyRowId(folderPath: string): string {
  return `empty:${folderPath}`;
}

export function buildVisibleRows(
  nodes: WorkspaceTreeNode[],
  expanded: Record<string, boolean>,
  emphasizedFolderPaths: Set<string>,
): TreeRow[] {
  const rows: TreeRow[] = [];

  function walk(node: WorkspaceTreeNode, depth: number) {
    rows.push({
      id: folderRowId(node.path),
      kind: "folder",
      folderPath: node.path,
      depth,
    });

    const isOpen =
      expanded[node.path] ?? emphasizedFolderPaths.has(node.path);
    if (!isOpen) return;

    for (const child of node.children) {
      walk(child, depth + 1);
    }
    for (const file of node.files) {
      rows.push({
        id: fileRowId(node.path, file),
        kind: "file",
        folderPath: node.path,
        fileName: file,
        depth: depth + 1,
      });
    }
    if (node.children.length === 0 && node.files.length === 0) {
      rows.push({
        id: emptyRowId(node.path),
        kind: "empty",
        folderPath: node.path,
        depth: depth + 1,
      });
    }
  }

  for (const node of nodes) {
    walk(node, 0);
  }
  return rows;
}

export function parseRowId(rowId: string): TreeRow | null {
  if (rowId.startsWith("folder:")) {
    const folderPath = rowId.slice("folder:".length);
    return { id: rowId, kind: "folder", folderPath, depth: 0 };
  }
  if (rowId.startsWith("file:")) {
    const rest = rowId.slice("file:".length);
    const slash = rest.lastIndexOf("/");
    if (slash < 0) return null;
    return {
      id: rowId,
      kind: "file",
      folderPath: rest.slice(0, slash),
      fileName: rest.slice(slash + 1),
      depth: 0,
    };
  }
  if (rowId.startsWith("empty:")) {
    const folderPath = rowId.slice("empty:".length);
    return { id: rowId, kind: "empty", folderPath, depth: 0 };
  }
  return null;
}

export function resolvePasteTarget(row: TreeRow): string | null {
  if (row.kind === "folder" || row.kind === "file" || row.kind === "empty") {
    return row.folderPath;
  }
  return null;
}
