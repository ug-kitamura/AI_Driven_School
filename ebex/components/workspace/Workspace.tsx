"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeInitializer } from "@/components/workspace/ThemeInitializer";
import { FileTreePane } from "@/components/workspace/FileTreePane";
import { EditorPane } from "@/components/workspace/EditorPane";
import { AgentPane } from "@/components/workspace/AgentPane";
import { PurposeDialog } from "@/components/workspace/PurposeDialog";
import { WorkspaceSettingsDialog } from "@/components/workspace/WorkspaceSettingsDialog";
import { PaneResizeHandle } from "@/components/workspace/PaneResizeHandle";
import { PANE2_MIN_WIDTH } from "@/components/workspace/pane-layout";
import { useWorkspacePaneWidths } from "@/components/workspace/use-workspace-pane-widths";
import { useWorkspaceSync } from "@/components/workspace/hooks/use-workspace-sync";
import { useRestoredFileSelection } from "@/components/workspace/hooks/use-restored-file-selection";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import type { AgentChatController } from "@/lib/agent-chat-controller";
import {
  saveLastFileSelection,
  type LastFileSelection,
} from "@/lib/workspace-file-selection";
import { ALLOWED_PREFIX } from "@/lib/workspace-constants";
import { getProjectFolderId } from "@/lib/workspace-tree";

type WorkspaceProps = {
  initialFolders: WorkspaceTreeNode[];
};

function resolveDefaultSelection(folders: WorkspaceTreeNode[]) {
  const first = folders[0];
  return { folderPath: first?.path ?? "", fileName: first?.files[0] ?? "" };
}

export function Workspace({ initialFolders }: WorkspaceProps) {
  const [folders, setFolders] = useState<WorkspaceTreeNode[]>(initialFolders);
  const defaultSelection = useMemo(
    () => resolveDefaultSelection(folders),
    [folders],
  );
  const restoredSelection = useRestoredFileSelection(folders);
  const [userSelection, setUserSelection] = useState<LastFileSelection | null>(
    null,
  );
  const activeSelection =
    userSelection ?? restoredSelection ?? defaultSelection;
  const selectedFolderPath = activeSelection.folderPath;
  const selectedFileName = activeSelection.fileName;
  const [fileContent, setFileContent] = useState("");
  const [pendingSave, setPendingSave] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [purposeOpen, setPurposeOpen] = useState(false);
  const workspaceRootRef = useRef<HTMLDivElement>(null);
  const [workspaceTotalWidth, setWorkspaceTotalWidth] = useState<number | null>(
    null,
  );
  const agentChatControllerRef = useRef<AgentChatController | null>(null);
  const insertCallbackRef = useRef<((markdown: string) => void) | null>(null);
  const overwriteCallbackRef = useRef<((markdown: string) => void) | null>(
    null,
  );
  const editingContentRef = useRef<string | null>(null);

  const { paneWidths, isResizing, resizeHandleProps, applyPaneWidths } =
    useWorkspacePaneWidths(workspaceTotalWidth);

  useEffect(() => {
    const el = workspaceRootRef.current;
    if (!el) return;
    const updateWidth = () => setWorkspaceTotalWidth(el.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const loadFileContent = useCallback(async (folderPath: string, fileName: string) => {
    if (!folderPath || !fileName) {
      setFileContent("");
      editingContentRef.current = null;
      return;
    }
    const res = await fetch(
      `/api/workspace/read-file?folderId=${encodeURIComponent(folderPath)}&fileName=${encodeURIComponent(fileName)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      setFileContent("");
      editingContentRef.current = null;
      return;
    }
    const data = (await res.json()) as { content: string };
    setFileContent(data.content);
    editingContentRef.current = data.content;
    saveLastFileSelection({ folderPath, fileName });
  }, []);

  useEffect(() => {
    if (pendingSave) return;
    if (!selectedFolderPath || !selectedFileName) return;

    let cancelled = false;
    void fetch(
      `/api/workspace/read-file?folderId=${encodeURIComponent(selectedFolderPath)}&fileName=${encodeURIComponent(selectedFileName)}`,
      { cache: "no-store" },
    )
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { content: string };
      })
      .then((data) => {
        if (cancelled || !data) {
          if (!cancelled && !data) {
            setFileContent("");
            editingContentRef.current = null;
          }
          return;
        }
        setFileContent(data.content);
        editingContentRef.current = data.content;
        saveLastFileSelection({
          folderPath: selectedFolderPath,
          fileName: selectedFileName,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFolderPath, selectedFileName, pendingSave]);

  const refreshFolders = useCallback(async () => {
    const res = await fetch("/api/workspace/load", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { folders: WorkspaceTreeNode[] };
    setFolders(data.folders);
  }, []);

  const handleSelectFile = useCallback(
    (folderPath: string, fileName: string) => {
      setUserSelection({ folderPath, fileName });
    },
    [],
  );

  const handleContentChange = useCallback((content: string) => {
    setFileContent(content);
    editingContentRef.current = content;
  }, []);

  const handleSave = useCallback(
    async (content: string) => {
      if (!selectedFolderPath || !selectedFileName) return;
      await fetch("/api/workspace/save-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: selectedFolderPath,
          fileName: selectedFileName,
          content,
        }),
      });
      await loadFileContent(selectedFolderPath, selectedFileName);
    },
    [selectedFolderPath, selectedFileName, loadFileContent],
  );

  useWorkspaceSync({
    folders,
    selectedFolderPath,
    selectedFileName,
    pendingSave,
    onFoldersLoaded: setFolders,
    onSelectionChange: ({ folderPath, fileName }) => {
      setUserSelection({ folderPath, fileName });
    },
  });

  const currentFilePath =
    selectedFolderPath && selectedFileName
      ? `${ALLOWED_PREFIX}${selectedFolderPath}/${selectedFileName}`
      : null;

  const projectFolderId = selectedFolderPath
    ? getProjectFolderId(selectedFolderPath)
    : "";

  return (
    <>
      <ThemeInitializer />
      <div
        ref={workspaceRootRef}
        className={cn(
          "flex h-svh w-full overflow-hidden bg-background",
          isResizing && "select-none",
        )}
      >
        <div
          className="flex h-full min-h-0 shrink-0 flex-col border-r"
          style={{ width: paneWidths.pane1 }}
        >
          <FileTreePane
            folders={folders}
            selectedFolderPath={selectedFolderPath}
            selectedFileName={selectedFileName}
            onSelectFile={handleSelectFile}
            onRefresh={refreshFolders}
          />
        </div>

        <PaneResizeHandle {...resizeHandleProps("pane1")} />

        <div
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
          style={{ minWidth: PANE2_MIN_WIDTH }}
        >
          <EditorPane
            folderPath={selectedFolderPath}
            fileName={selectedFileName}
            content={fileContent}
            onContentChange={handleContentChange}
            onSave={handleSave}
            onPendingSaveChange={setPendingSave}
            onRegisterInsertCallback={(cb) => {
              insertCallbackRef.current = cb;
            }}
            onRegisterOverwriteCallback={(cb) => {
              overwriteCallbackRef.current = cb;
            }}
          />
        </div>

        <PaneResizeHandle {...resizeHandleProps("pane3")} />

        <div
          className="flex h-full min-h-0 shrink-0 flex-col"
          style={{ width: paneWidths.pane3 }}
        >
          <AgentPane
            folderId={projectFolderId}
            currentFilePath={currentFilePath}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenPurpose={() => setPurposeOpen(true)}
            onOverwriteEditor={(markdown) => overwriteCallbackRef.current?.(markdown)}
            agentChatControllerRef={agentChatControllerRef}
          />
        </div>
      </div>

      <WorkspaceSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        currentPaneWidths={paneWidths}
        onApplyPaneWidths={applyPaneWidths}
      />
      <PurposeDialog open={purposeOpen} onOpenChange={setPurposeOpen} />
    </>
  );
}
