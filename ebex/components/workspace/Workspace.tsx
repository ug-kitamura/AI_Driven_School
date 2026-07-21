"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeInitializer } from "@/components/workspace/ThemeInitializer";
import { FileTreePane } from "@/components/workspace/FileTreePane";
import { EditorPane } from "@/components/workspace/EditorPane";
import { AgentPane } from "@/components/workspace/AgentPane";
import { PurposeDialog } from "@/components/workspace/PurposeDialog";
import { WorkspaceSettingsDialog } from "@/components/workspace/WorkspaceSettingsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PaneResizeHandle } from "@/components/workspace/PaneResizeHandle";
import { PANE2_MIN_WIDTH } from "@/components/workspace/pane-layout";
import { useWorkspacePaneWidths } from "@/components/workspace/use-workspace-pane-widths";
import { useWorkspaceSync } from "@/components/workspace/hooks/use-workspace-sync";
import { useRestoredFileSelection } from "@/components/workspace/hooks/use-restored-file-selection";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import type { AgentChatController } from "@/lib/agent-chat-controller";
import { useAgentSessionChrome } from "@/components/workspace/use-agent-session-chrome";
import {
  isNoFileSentinel,
  saveLastFileSelection,
  type LastFileSelection,
} from "@/lib/workspace-file-selection";
import { ALLOWED_PREFIX } from "@/lib/workspace-constants";
import { getProjectFolderId, isEmptyFolderInTree } from "@/lib/workspace-tree";
import { isTextEditableMode, resolvePane2Mode } from "@/lib/file-preview";

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
  const isNoFileEmptySelection =
    isNoFileSentinel(selectedFileName) &&
    isEmptyFolderInTree(folders, selectedFolderPath);
  const [fileContent, setFileContent] = useState("");
  const [pendingSave, setPendingSave] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [purposeOpen, setPurposeOpen] = useState(false);
  const workspaceRootRef = useRef<HTMLDivElement>(null);
  const [workspaceTotalWidth, setWorkspaceTotalWidth] = useState<number | null>(
    null,
  );
  const agentChatControllerRef = useRef<AgentChatController | null>(null);
  const [agentControllerVersion, setAgentControllerVersion] = useState(0);
  const agentSessionChrome = useAgentSessionChrome(
    agentChatControllerRef,
    agentControllerVersion,
  );
  const agentBusyProjectFolderId =
    agentSessionChrome?.isStreaming && agentSessionChrome.projectFolderId
      ? agentSessionChrome.projectFolderId
      : null;
  const onAgentControllerReady = useCallback(() => {
    setAgentControllerVersion((v) => v + 1);
  }, []);
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

  const loadFileContent = useCallback(
    async (folderPath: string, fileName: string) => {
      if (!folderPath || !fileName) {
        setFileContent("");
        editingContentRef.current = null;
        return;
      }
      if (
        isNoFileSentinel(fileName) &&
        isEmptyFolderInTree(folders, folderPath)
      ) {
        setFileContent("");
        editingContentRef.current = null;
        saveLastFileSelection({ folderPath, fileName });
        return;
      }
      if (!isTextEditableMode(resolvePane2Mode(fileName))) {
        setFileContent("");
        editingContentRef.current = null;
        saveLastFileSelection({ folderPath, fileName });
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
    },
    [folders],
  );

  useEffect(() => {
    if (pendingSave) return;
    if (!selectedFolderPath || !selectedFileName) return;

    // 本文クリアは handleSelectFile（イベントハンドラ）側で実施済み
    if (isNoFileEmptySelection) {
      saveLastFileSelection({
        folderPath: selectedFolderPath,
        fileName: selectedFileName,
      });
      return;
    }

    if (!isTextEditableMode(resolvePane2Mode(selectedFileName))) {
      saveLastFileSelection({
        folderPath: selectedFolderPath,
        fileName: selectedFileName,
      });
      return;
    }

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
  }, [
    selectedFolderPath,
    selectedFileName,
    pendingSave,
    isNoFileEmptySelection,
  ]);

  const refreshFolders = useCallback(async () => {
    const res = await fetch("/api/workspace/load", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { folders: WorkspaceTreeNode[] };
    setFolders(data.folders);
  }, []);

  const applySelection = useCallback(
    (folderPath: string, fileName: string) => {
      setUserSelection({ folderPath, fileName });
      if (
        isNoFileSentinel(fileName) ||
        !isTextEditableMode(resolvePane2Mode(fileName))
      ) {
        setFileContent("");
        editingContentRef.current = null;
      }
    },
    [],
  );

  // フォルダ切替の確認待ち（A 案）。AI 応答中に別プロジェクトフォルダへ移ると
  // 応答を中断するため、承認を挟む。
  const [pendingFolderSwitch, setPendingFolderSwitch] =
    useState<LastFileSelection | null>(null);

  const handleSelectFile = useCallback(
    (folderPath: string, fileName: string) => {
      const targetProjectFolderId = folderPath
        ? getProjectFolderId(folderPath)
        : "";
      // ストリーミング中に別プロジェクトフォルダへ移ろうとしたときだけ確認を挟む
      if (
        agentBusyProjectFolderId &&
        targetProjectFolderId &&
        targetProjectFolderId !== agentBusyProjectFolderId
      ) {
        setPendingFolderSwitch({ folderPath, fileName });
        return;
      }
      applySelection(folderPath, fileName);
    },
    [agentBusyProjectFolderId, applySelection],
  );

  const confirmFolderSwitch = useCallback(() => {
    agentChatControllerRef.current?.interruptForSwitch();
    if (pendingFolderSwitch) {
      applySelection(
        pendingFolderSwitch.folderPath,
        pendingFolderSwitch.fileName,
      );
    }
    setPendingFolderSwitch(null);
  }, [applySelection, pendingFolderSwitch]);

  const handleContentChange = useCallback((content: string) => {
    setFileContent(content);
    editingContentRef.current = content;
  }, []);

  const handleSave = useCallback(
    async (content: string) => {
      if (!selectedFolderPath || !selectedFileName) return;
      if (isNoFileEmptySelection) return;
      if (!isTextEditableMode(resolvePane2Mode(selectedFileName))) return;
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
    [
      selectedFolderPath,
      selectedFileName,
      loadFileContent,
      isNoFileEmptySelection,
    ],
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
    selectedFolderPath && selectedFileName && !isNoFileEmptySelection
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
          // 高さは body（バナー＋ワークスペース）の flex 配分から受け取る
          "flex min-h-0 w-full flex-1 overflow-hidden bg-background",
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
            onAddFileToChat={(folderPath, fileName) =>
              agentChatControllerRef.current?.addFileAttachment({
                path: `${ALLOWED_PREFIX}${folderPath}/${fileName}`,
                name: fileName,
              })
            }
            chatProjectFolderId={projectFolderId}
            onRefresh={refreshFolders}
            onOpenPurpose={() => setPurposeOpen(true)}
            agentBusyProjectFolderId={agentBusyProjectFolderId}
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
            isNoFileEmptySelection={isNoFileEmptySelection}
            content={fileContent}
            isResizing={isResizing}
            onContentChange={handleContentChange}
            onSave={handleSave}
            onPendingSaveChange={setPendingSave}
            onRegisterInsertCallback={(cb) => {
              insertCallbackRef.current = cb;
            }}
            onRegisterOverwriteCallback={(cb) => {
              overwriteCallbackRef.current = cb;
            }}
            onOpenFile={handleSelectFile}
          />
        </div>

        <PaneResizeHandle {...resizeHandleProps("pane3")} />

        <div
          className="flex h-full min-h-0 shrink-0 flex-col"
          style={{ width: paneWidths.pane3 }}
        >
          <AgentPane
            folderId={projectFolderId}
            folders={folders}
            currentFilePath={currentFilePath}
            onOpenSettings={() => setSettingsOpen(true)}
            onOverwriteEditor={(markdown) =>
              overwriteCallbackRef.current?.(markdown)
            }
            agentChatControllerRef={agentChatControllerRef}
            onControllerReady={onAgentControllerReady}
          />
        </div>
      </div>

      <AlertDialog
        open={pendingFolderSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingFolderSwitch(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AI 応答を中断して移動しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              現在このフォルダで AI
              が応答中です。別のフォルダへ移動すると応答を中断します。作りかけのファイルは残る場合があります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>とどまる</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFolderSwitch}>
              中断して移動
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
