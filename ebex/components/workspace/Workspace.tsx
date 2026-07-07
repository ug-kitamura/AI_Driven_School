"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import type { WorkspaceFolder } from "@/lib/workspace-loader";
import type { AgentChatController } from "@/lib/agent-chat-controller";
import {
  loadLastFileSelection,
  saveLastFileSelection,
} from "@/lib/workspace-file-selection";
import { ALLOWED_PREFIX } from "@/lib/workspace-constants";

type WorkspaceProps = {
  initialFolders: WorkspaceFolder[];
};

export function Workspace({ initialFolders }: WorkspaceProps) {
  const [folders, setFolders] = useState<WorkspaceFolder[]>(initialFolders);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
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

  useEffect(() => {
    const last = loadLastFileSelection();
    if (last) {
      const folder = initialFolders.find((f) => f.id === last.folderId);
      if (folder?.files.includes(last.fileName)) {
        setSelectedFolderId(last.folderId);
        setSelectedFileName(last.fileName);
        return;
      }
    }
    const first = initialFolders[0];
    if (first) {
      setSelectedFolderId(first.id);
      setSelectedFileName(first.files[0] ?? "");
    }
  }, [initialFolders]);

  const refreshFolders = useCallback(async () => {
    const res = await fetch("/api/workspace/load", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { folders: WorkspaceFolder[] };
    setFolders(data.folders);
  }, []);

  const loadFileContent = useCallback(async (folderId: string, fileName: string) => {
    if (!folderId || !fileName) {
      setFileContent("");
      editingContentRef.current = null;
      return;
    }
    const res = await fetch(
      `/api/workspace/read-file?folderId=${encodeURIComponent(folderId)}&fileName=${encodeURIComponent(fileName)}`,
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
    saveLastFileSelection({ folderId, fileName });
  }, []);

  useEffect(() => {
    if (pendingSave) return;
    void loadFileContent(selectedFolderId, selectedFileName);
  }, [selectedFolderId, selectedFileName, loadFileContent, pendingSave]);

  const handleSelectFile = useCallback(
    (folderId: string, fileName: string) => {
      setSelectedFolderId(folderId);
      setSelectedFileName(fileName);
    },
    [],
  );

  const handleContentChange = useCallback((content: string) => {
    setFileContent(content);
    editingContentRef.current = content;
  }, []);

  const handleSave = useCallback(
    async (content: string) => {
      if (!selectedFolderId || !selectedFileName) return;
      await fetch("/api/workspace/save-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: selectedFolderId,
          fileName: selectedFileName,
          content,
        }),
      });
    },
    [selectedFolderId, selectedFileName],
  );

  useWorkspaceSync({
    folders,
    selectedFolderId,
    selectedFileName,
    pendingSave,
    onFoldersLoaded: setFolders,
    onSelectionChange: ({ folderId, fileName }) => {
      setSelectedFolderId(folderId);
      setSelectedFileName(fileName);
    },
  });

  const currentFilePath =
    selectedFolderId && selectedFileName
      ? `${ALLOWED_PREFIX}${selectedFolderId}/${selectedFileName}`
      : null;

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
            selectedFolderId={selectedFolderId}
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
            folderId={selectedFolderId}
            fileName={selectedFileName}
            content={fileContent}
            onContentChange={handleContentChange}
            onSave={handleSave}
            onPendingSaveChange={setPendingSave}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenPurpose={() => setPurposeOpen(true)}
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
            folderId={selectedFolderId}
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
