"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  isNoFileSentinel,
  loadLastFileSelection,
  type LastFileSelection,
} from "@/lib/workspace-file-selection";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import { fileExistsInTree, isEmptyFolderInTree } from "@/lib/workspace-tree";

const EMPTY_SNAPSHOT = "";

function readRestoredSelectionKey(folders: WorkspaceTreeNode[]): string {
  const last = loadLastFileSelection();
  if (!last) return EMPTY_SNAPSHOT;
  // 実ファイル（同名 `no file` 含む）を優先
  if (fileExistsInTree(folders, last.folderPath, last.fileName)) {
    return JSON.stringify([last.folderPath, last.fileName]);
  }
  if (
    isNoFileSentinel(last.fileName) &&
    isEmptyFolderInTree(folders, last.folderPath)
  ) {
    return JSON.stringify([last.folderPath, last.fileName]);
  }
  return EMPTY_SNAPSHOT;
}

function parseRestoredSelectionKey(key: string): LastFileSelection | null {
  if (!key) return null;
  try {
    const [folderPath, fileName] = JSON.parse(key) as [string, string];
    if (!folderPath || !fileName) return null;
    return { folderPath, fileName };
  } catch {
    return null;
  }
}

/** SSR と初回 hydration では null。マウント後に localStorage の選択を返す。 */
export function useRestoredFileSelection(folders: WorkspaceTreeNode[]) {
  const snapshotKey = useSyncExternalStore(
    () => () => {},
    () => readRestoredSelectionKey(folders),
    () => EMPTY_SNAPSHOT,
  );

  return useMemo(() => parseRestoredSelectionKey(snapshotKey), [snapshotKey]);
}
