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
import { isTextEditableMode, resolvePane2Mode } from "@/lib/file-preview";

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
  /**
   * 外部変更により選択中ファイルの本文を読み直したときに呼ばれる。
   * 保存待ち・選択変更のガードは本フックで済ませてあるので、呼び出し側は
   * 「現在の内容と違えば反映する」だけでよい。
   */
  onSelectedFileContentLoaded?: (content: string) => void;
}) {
  const {
    folders,
    selectedFolderPath,
    selectedFileName,
    pendingSave,
    onFoldersLoaded,
    onSelectionChange,
    onSelectedFileContentLoaded,
  } = options;

  const lastFingerprintRef = useRef("");
  const foldersRef = useRef(folders);
  const selectionRef = useRef({
    folderPath: selectedFolderPath,
    fileName: selectedFileName,
  });
  const pendingSaveRef = useRef(pendingSave);

  // ポーリングは購読者の識別子に左右されず動き続ける必要がある。コールバックを
  // 依存配列に入れると、再描画のたびに interval が張り直されて 3 秒に到達できず、
  // AI がファイルを書いている最中（＝再描画が多い時間帯）に同期が止まってしまう。
  const onFoldersLoadedRef = useRef(onFoldersLoaded);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onSelectedFileContentLoadedRef = useRef(onSelectedFileContentLoaded);

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

  useEffect(() => {
    onFoldersLoadedRef.current = onFoldersLoaded;
    onSelectionChangeRef.current = onSelectionChange;
    onSelectedFileContentLoadedRef.current = onSelectedFileContentLoaded;
  }, [onFoldersLoaded, onSelectionChange, onSelectedFileContentLoaded]);

  const setPendingSave = useCallback((pending: boolean) => {
    pendingSaveRef.current = pending;
  }, []);

  useEffect(() => {
    let cancelled = false;

    /**
     * 選択中ファイルの本文を読み直す。対象はテキスト編集可能なモードのみで、
     * 画像・PDF・zip などの閲覧専用や未選択では何もしない。
     */
    async function refreshSelectedFileContent(selection: WorkspaceSelection) {
      const { folderPath, fileName } = selection;
      if (!folderPath || !fileName) return;
      if (isNoFileSentinel(fileName)) return;
      if (!isTextEditableMode(resolvePane2Mode(fileName))) return;
      if (pendingSaveRef.current) return;

      const res = await fetch(
        `/api/workspace/read-file?folderId=${encodeURIComponent(folderPath)}&fileName=${encodeURIComponent(fileName)}`,
        { cache: "no-store" },
      );
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { content: string };
      if (cancelled) return;

      // 往復のあいだに編集が始まっていたら、取得済みの内容で打鍵を消さない。
      if (pendingSaveRef.current) return;
      // 往復のあいだに選択が変わっていたら、古い結果を新しい選択へ適用しない。
      const now = selectionRef.current;
      if (now.folderPath !== folderPath || now.fileName !== fileName) return;

      onSelectedFileContentLoadedRef.current?.(data.content);
    }

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

        const selectionChanged =
          nextFolderPath !== current.folderPath ||
          nextFileName !== current.fileName;

        if (selectionChanged) {
          if (!pendingSaveRef.current) {
            onSelectionChangeRef.current({
              folderPath: nextFolderPath,
              fileName: nextFileName,
            });
          }
        }

        onFoldersLoadedRef.current(fresh.folders);

        // 選択が変わる場合は選択変更側の読み込みに任せ、二重取得しない。
        // 「選択は同じで中身だけ変わった」ケースだけをここで拾う。
        if (!selectionChanged) {
          await refreshSelectedFileContent(current);
        }
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
  }, []);

  return { setPendingSave, remapFolderPath };
}
