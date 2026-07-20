"use client";

import { useEffect, useRef, useCallback } from "react";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import {
  fileExistsInTree,
  findTreeNode,
  folderExistsInTree,
  isEmptyFolderInTree,
  remapFolderPath,
} from "@/lib/workspace-tree";
import { isNoFileSentinel } from "@/lib/workspace-file-selection";

const POLL_INTERVAL_MS = 3000;

export type WorkspaceSelection = {
  folderPath: string;
  fileName: string;
};

export function useWorkspaceSync(options: {
  folders: WorkspaceTreeNode[];
  selectedFolderPath: string;
  selectedFileName: string;
  pendingSave: boolean;
  onFoldersLoaded: (folders: WorkspaceTreeNode[]) => void;
  onSelectionChange: (selection: WorkspaceSelection) => void;
}) {
  const {
    folders,
    selectedFolderPath,
    selectedFileName,
    pendingSave,
    onFoldersLoaded,
    onSelectionChange,
  } = options;

  const lastFingerprintRef = useRef("");
  const foldersRef = useRef(folders);
  const selectionRef = useRef({
    folderPath: selectedFolderPath,
    fileName: selectedFileName,
  });
  const pendingSaveRef = useRef(pendingSave);

  useEffect(() => {
    foldersRef.current = folders;
  }, [folders]);

  useEffect(() => {
    selectionRef.current = {
      folderPath: selectedFolderPath,
      fileName: selectedFileName,
    };
  }, [selectedFolderPath, selectedFileName]);

  useEffect(() => {
    pendingSaveRef.current = pendingSave;
  }, [pendingSave]);

  const setPendingSave = useCallback((pending: boolean) => {
    pendingSaveRef.current = pending;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAndMerge() {
      try {
        const mtimeRes = await fetch("/api/workspace/mtime", {
          cache: "no-store",
        });
        if (!mtimeRes.ok || cancelled) return;
        const { fingerprint } = (await mtimeRes.json()) as {
          mtime: number;
          fingerprint: string;
        };

        if (lastFingerprintRef.current === "") {
          lastFingerprintRef.current = fingerprint;
          return;
        }
        if (fingerprint === lastFingerprintRef.current) return;
        lastFingerprintRef.current = fingerprint;

        const dataRes = await fetch("/api/workspace/load", {
          cache: "no-store",
        });
        if (!dataRes.ok || cancelled) return;
        const fresh = (await dataRes.json()) as {
          folders: WorkspaceTreeNode[];
        };

        const current = selectionRef.current;

        let nextFolderPath = current.folderPath;
        let nextFileName = current.fileName;

        if (
          current.folderPath &&
          !folderExistsInTree(fresh.folders, current.folderPath)
        ) {
          nextFolderPath = fresh.folders[0]?.path ?? "";
          nextFileName = fresh.folders[0]?.files[0] ?? "";
        } else if (current.fileName) {
          if (
            fileExistsInTree(
              fresh.folders,
              current.folderPath,
              current.fileName,
            )
          ) {
            // keep current real file selection
          } else if (
            isNoFileSentinel(current.fileName) &&
            isEmptyFolderInTree(fresh.folders, current.folderPath)
          ) {
            // keep empty-folder sentinel selection
          } else {
            const folder = findTreeNode(fresh.folders, current.folderPath);
            nextFileName = folder?.files[0] ?? "";
          }
        }

        if (
          nextFolderPath !== current.folderPath ||
          nextFileName !== current.fileName
        ) {
          if (!pendingSaveRef.current) {
            onSelectionChange({
              folderPath: nextFolderPath,
              fileName: nextFileName,
            });
          }
        }

        onFoldersLoaded(fresh.folders);
      } catch {
        /* ignore network errors */
      }
    }

    const timer = setInterval(() => {
      void fetchAndMerge();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onFoldersLoaded, onSelectionChange]);

  return { setPendingSave, remapFolderPath };
}
