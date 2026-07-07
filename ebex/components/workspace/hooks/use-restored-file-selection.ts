"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  loadLastFileSelection,
  type LastFileSelection,
} from "@/lib/workspace-file-selection";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import { fileExistsInTree } from "@/lib/workspace-tree";

const EMPTY_SNAPSHOT = "";

function readRestoredSelectionKey(folders: WorkspaceTreeNode[]): string {
  const last = loadLastFileSelection();
  if (last && fileExistsInTree(folders, last.folderPath, last.fileName)) {
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

  return useMemo(
    () => parseRestoredSelectionKey(snapshotKey),
    [snapshotKey],
  );
}
