import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import { isNoFileSentinel } from "@/lib/workspace-file-selection";
import { getParentFolderPath } from "@/lib/workspace-tree-path";

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

export function resolveSelectedFileRowId(
  selectedFolderPath: string,
  selectedFileName: string,
): string | null {
  if (!selectedFolderPath || !selectedFileName) return null;
  if (isNoFileSentinel(selectedFileName)) {
    return emptyRowId(selectedFolderPath);
  }
  return fileRowId(selectedFolderPath, selectedFileName);
}

export type LeftNavigationResult = {
  collapsePaths: string[];
  focusRowId: string | null;
};

export function resolveLeftNavigation(
  row: TreeRow,
  options: {
    isFolderExpanded: (folderPath: string) => boolean;
    isProjectFolder: (folderPath: string) => boolean;
    getParentFolderPath: (folderPath: string) => string | null;
  },
): LeftNavigationResult | null {
  const { isFolderExpanded, isProjectFolder, getParentFolderPath } = options;

  if (row.kind === "folder") {
    if (isFolderExpanded(row.folderPath)) {
      return {
        collapsePaths: [row.folderPath],
        focusRowId: folderRowId(row.folderPath),
      };
    }
    if (isProjectFolder(row.folderPath)) {
      return { collapsePaths: [], focusRowId: null };
    }
    const parentPath = getParentFolderPath(row.folderPath);
    if (!parentPath) {
      return { collapsePaths: [], focusRowId: null };
    }
    return {
      collapsePaths: [parentPath],
      focusRowId: folderRowId(parentPath),
    };
  }

  if (row.kind === "file" || row.kind === "empty") {
    return {
      collapsePaths: [row.folderPath],
      focusRowId: folderRowId(row.folderPath),
    };
  }

  return null;
}

/** 兄弟判定用の親キー。プロジェクト行は null。 */
export function getRowParentKey(row: TreeRow): string | null {
  if (row.kind === "folder") {
    return getParentFolderPath(row.folderPath);
  }
  return row.folderPath;
}

export type HomeEndNavigationResult = {
  /** null は no-op（すでに端、または無効な index） */
  focusRowId: string | null;
};

/**
 * Home / End / Ctrl+Home / Ctrl+End の移動先を解決する。
 * Ctrl なし: 同一親の visible な兄弟の先頭／末尾。
 * Ctrl あり: visibleRows 全体の先頭／末尾。
 */
export function resolveHomeEndNavigation(
  rows: TreeRow[],
  index: number,
  key: "Home" | "End",
  ctrlKey: boolean,
): HomeEndNavigationResult {
  if (rows.length === 0 || index < 0 || index >= rows.length) {
    return { focusRowId: null };
  }

  const current = rows[index];
  if (!current) {
    return { focusRowId: null };
  }

  if (ctrlKey) {
    const target = key === "Home" ? rows[0] : rows[rows.length - 1];
    if (!target || target.id === current.id) {
      return { focusRowId: null };
    }
    return { focusRowId: target.id };
  }

  const parentKey = getRowParentKey(current);
  const siblings = rows.filter((row) => getRowParentKey(row) === parentKey);
  const target =
    key === "Home" ? siblings[0] : siblings[siblings.length - 1];
  if (!target || target.id === current.id) {
    return { focusRowId: null };
  }
  return { focusRowId: target.id };
}
