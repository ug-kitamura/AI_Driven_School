"use client";

import { useEffect, useRef, useCallback } from "react";
import type { WorkspaceFolder } from "@/lib/workspace-loader";

const POLL_INTERVAL_MS = 3000;

export type WorkspaceSelection = {
  folderId: string;
  fileName: string;
};

export function useWorkspaceSync(options: {
  folders: WorkspaceFolder[];
  selectedFolderId: string;
  selectedFileName: string;
  pendingSave: boolean;
  onFoldersLoaded: (folders: WorkspaceFolder[]) => void;
  onSelectionChange: (selection: WorkspaceSelection) => void;
}) {
  const {
    folders,
    selectedFolderId,
    selectedFileName,
    pendingSave,
    onFoldersLoaded,
    onSelectionChange,
  } = options;

  const lastFingerprintRef = useRef("");
  const foldersRef = useRef(folders);
  const selectionRef = useRef({ folderId: selectedFolderId, fileName: selectedFileName });
  const pendingSaveRef = useRef(pendingSave);

  useEffect(() => {
    foldersRef.current = folders;
  }, [folders]);

  useEffect(() => {
    selectionRef.current = { folderId: selectedFolderId, fileName: selectedFileName };
  }, [selectedFolderId, selectedFileName]);

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
        const mtimeRes = await fetch("/api/workspace/mtime", { cache: "no-store" });
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

        const dataRes = await fetch("/api/workspace/load", { cache: "no-store" });
        if (!dataRes.ok || cancelled) return;
        const fresh = (await dataRes.json()) as { folders: WorkspaceFolder[] };

        const current = selectionRef.current;

        let nextFolderId = current.folderId;
        let nextFileName = current.fileName;

        const folderExists = fresh.folders.some((f) => f.id === current.folderId);
        if (!folderExists) {
          nextFolderId = fresh.folders[0]?.id ?? "";
          nextFileName = fresh.folders[0]?.files[0] ?? "";
        } else if (current.fileName) {
          const folder = fresh.folders.find((f) => f.id === current.folderId);
          if (folder && !folder.files.includes(current.fileName)) {
            nextFileName = folder.files[0] ?? "";
          }
        }

        if (
          nextFolderId !== current.folderId ||
          nextFileName !== current.fileName
        ) {
          if (!pendingSaveRef.current) {
            onSelectionChange({ folderId: nextFolderId, fileName: nextFileName });
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

  return { setPendingSave };
}
