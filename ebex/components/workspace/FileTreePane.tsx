"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import {
  applyEventDateToSuggestedName,
  resolveEventDatePrefix,
  suggestUntitledFolderName,
} from "@/lib/workspace-folder-name";
import {
  FILE_ICON_COMPONENTS,
  getFileIconColorClass,
  resolveFileIconCategory,
} from "@/lib/workspace-file-icon";
import { suggestFolderSlug } from "@/lib/workspace-slug";
import {
  buildRenamedFolderPath,
  collectProjectFolderPaths,
  filterWorkspaceTree,
  getAncestorFolderPaths,
  getFolderBaseName,
  remapFolderPath,
} from "@/lib/workspace-tree";
import {
  buildVisibleRows,
  emptyRowId,
  fileRowId,
  folderRowId,
  type TreeRow,
} from "@/lib/workspace-tree-flatten";
import {
  getParentFolderPath,
  getProjectRoot,
  isDescendantPath,
  isProjectFolder,
} from "@/lib/workspace-tree-path";
import logoSmall from "@/images/logo_small.png";

const NO_CHANGE_MESSAGE = "名前が変更されていません";
const INTERNAL_DRAG_MIME = "application/x-ebex-tree";

type Props = {
  folders: WorkspaceTreeNode[];
  selectedFolderPath: string;
  selectedFileName: string;
  onSelectFile: (folderPath: string, fileName: string) => void;
  onRefresh: () => Promise<void>;
  onOpenPurpose?: () => void;
};

type DialogMode =
  | { type: "add-folder" }
  | { type: "add-subfolder"; parentPath: string }
  | { type: "rename-folder"; folderPath: string }
  | { type: "delete-folder"; folderPath: string }
  | { type: "add-file"; folderPath: string }
  | { type: "rename-file"; folderPath: string; fileName: string }
  | { type: "delete-file"; folderPath: string; fileName: string }
  | null;

type TreeClipboard =
  | { kind: "file"; folderPath: string; fileName: string }
  | { kind: "folder"; folderPath: string }
  | null;

type InternalDragPayload =
  | { kind: "file"; folderPath: string; fileName: string }
  | { kind: "folder"; folderPath: string };

type TreeInteraction = {
  focusedRowId: string | null;
  contextMenuTargetId: string | null;
  dropTargetPath: string | null;
  clipboard: TreeClipboard;
  selectedFolderPath: string;
  selectedFileName: string;
  onFocusRow: (rowId: string) => void;
  onContextMenuChange: (rowId: string | null) => void;
  onSetDropTarget: (folderPath: string) => void;
  onClearDropTarget: () => void;
  onDrop: (folderPath: string, event: React.DragEvent) => void;
  onCopy: (payload: TreeClipboard) => void;
  onPaste: (targetFolderPath: string) => void;
  onOpenDialog: (dialog: DialogMode) => void;
  onSetNameInput: (value: string) => void;
  onToggleExpanded: (folderPath: string, isOpen: boolean) => void;
  onSelectFile: (folderPath: string, fileName: string) => void;
  rowHighlight: (rowId: string, isFileSelected: boolean) => string;
  canPaste: (row: TreeRow) => boolean;
};

type TreeNodeProps = {
  node: WorkspaceTreeNode;
  depth: number;
  expanded: Record<string, boolean>;
  emphasizedFolderPaths: Set<string>;
  interaction: TreeInteraction;
};

function FileRowIcon({ fileName }: { fileName: string }) {
  const category = resolveFileIconCategory(fileName);
  const Icon = FILE_ICON_COMPONENTS[category];
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center",
        getFileIconColorClass(category),
      )}
      aria-hidden="true"
    >
      <Icon className="size-3.5" />
    </span>
  );
}

function readDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: FileSystemEntry[] = [];
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function importFileEntry(
  postJson: (url: string, body: unknown) => Promise<unknown>,
  entry: FileSystemFileEntry,
  folderPath: string,
) {
  const file = await new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
  const text = await file.text();
  await postJson("/api/workspace/create-file", {
    folderId: folderPath,
    fileName: file.name,
    content: text,
  });
}

async function importDirectoryEntry(
  postJson: (url: string, body: unknown) => Promise<unknown>,
  entry: FileSystemDirectoryEntry,
  parentPath: string,
) {
  const result = (await postJson("/api/workspace/create-folder", {
    parentPath,
    name: entry.name,
  })) as { path?: string };
  const childPath = result.path ?? `${parentPath}/${entry.name}`;
  const reader = entry.createReader();
  const entries = await readDirectoryEntries(reader);
  for (const child of entries) {
    if (child.isFile) {
      await importFileEntry(postJson, child as FileSystemFileEntry, childPath);
    } else if (child.isDirectory) {
      await importDirectoryEntry(
        postJson,
        child as FileSystemDirectoryEntry,
        childPath,
      );
    }
  }
}

async function importOsItems(
  postJson: (url: string, body: unknown) => Promise<unknown>,
  items: DataTransferItemList,
  folderPath: string,
) {
  for (const item of Array.from(items)) {
    const entry = item.webkitGetAsEntry?.();
    if (!entry) continue;
    if (entry.isFile) {
      await importFileEntry(postJson, entry as FileSystemFileEntry, folderPath);
    } else if (entry.isDirectory) {
      await importDirectoryEntry(
        postJson,
        entry as FileSystemDirectoryEntry,
        folderPath,
      );
    }
  }
}

function TreeNode({ node, depth, expanded, emphasizedFolderPaths, interaction }: TreeNodeProps) {
  const isOpen = expanded[node.path] ?? emphasizedFolderPaths.has(node.path);
  const folderRow = folderRowId(node.path);
  const isDropTarget = interaction.dropTargetPath === node.path;
  const isSubfolder = !isProjectFolder(node.path);

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg",
        isDropTarget && "ring-2 ring-primary",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        interaction.onSetDropTarget(node.path);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          interaction.onClearDropTarget();
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void interaction.onDrop(node.path, event);
      }}
    >
      <ContextMenu
        onOpenChange={(open) =>
          interaction.onContextMenuChange(open ? folderRow : null)
        }
      >
        <ContextMenuTrigger
          render={
            <div
              className={interaction.rowHighlight(folderRow, false)}
              draggable={isSubfolder}
              onDragStart={(event) => {
                if (!isSubfolder) return;
                const payload: InternalDragPayload = {
                  kind: "folder",
                  folderPath: node.path,
                };
                event.dataTransfer.setData(
                  INTERNAL_DRAG_MIME,
                  JSON.stringify(payload),
                );
                event.dataTransfer.effectAllowed = "move";
              }}
              onMouseEnter={() => interaction.onFocusRow(folderRow)}
              onClick={() => interaction.onFocusRow(folderRow)}
            >
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center"
                onClick={() =>
                  interaction.onToggleExpanded(node.path, isOpen)
                }
                aria-label={isOpen ? "折りたたむ" : "展開する"}
              >
                {isOpen ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>
              <span className="min-w-0 flex-1 truncate text-left text-sm">
                {node.name}
              </span>
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              interaction.onSetNameInput("");
              interaction.onOpenDialog({
                type: "add-subfolder",
                parentPath: node.path,
              });
            }}
          >
            add folder
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              interaction.onSetNameInput("");
              interaction.onOpenDialog({ type: "add-file", folderPath: node.path });
            }}
          >
            add file
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              interaction.onSetNameInput(getFolderBaseName(node.path));
              interaction.onOpenDialog({
                type: "rename-folder",
                folderPath: node.path,
              });
            }}
          >
            rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() =>
              interaction.onOpenDialog({
                type: "delete-folder",
                folderPath: node.path,
              })
            }
          >
            delete
          </ContextMenuItem>
          {isSubfolder ? (
            <>
              <ContextMenuItem
                variant="muted"
                onClick={() =>
                  interaction.onCopy({ kind: "folder", folderPath: node.path })
                }
              >
                copy
              </ContextMenuItem>
              <ContextMenuItem
                variant="muted"
                disabled={!interaction.clipboard}
                onClick={() => interaction.onPaste(node.path)}
              >
                paste
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>

      {isOpen ? (
        <div className="ml-[9px] flex flex-col border-l border-border pl-[7px]">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              emphasizedFolderPaths={emphasizedFolderPaths}
              interaction={interaction}
            />
          ))}
          {node.files.map((file) => {
            const row = fileRowId(node.path, file);
            const isFileSelected =
              interaction.selectedFolderPath === node.path &&
              interaction.selectedFileName === file;
            return (
              <ContextMenu
                key={file}
                onOpenChange={(open) =>
                  interaction.onContextMenuChange(open ? row : null)
                }
              >
                <ContextMenuTrigger
                  render={
                    <div
                      className={interaction.rowHighlight(row, isFileSelected)}
                      draggable
                      onDragStart={(event) => {
                        const payload: InternalDragPayload = {
                          kind: "file",
                          folderPath: node.path,
                          fileName: file,
                        };
                        event.dataTransfer.setData(
                          INTERNAL_DRAG_MIME,
                          JSON.stringify(payload),
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        interaction.onSetDropTarget(node.path);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void interaction.onDrop(node.path, event);
                      }}
                      onMouseEnter={() => interaction.onFocusRow(row)}
                      onClick={() => interaction.onFocusRow(row)}
                    >
                      <FileRowIcon fileName={file} />
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left"
                        onClick={() => interaction.onSelectFile(node.path, file)}
                      >
                        {file}
                      </button>
                    </div>
                  }
                />
                <ContextMenuContent>
                  <ContextMenuItem
                    variant="muted"
                    onClick={() => {
                      interaction.onSetNameInput(file);
                      interaction.onOpenDialog({
                        type: "rename-file",
                        folderPath: node.path,
                        fileName: file,
                      });
                    }}
                  >
                    rename
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() =>
                      interaction.onOpenDialog({
                        type: "delete-file",
                        folderPath: node.path,
                        fileName: file,
                      })
                    }
                  >
                    delete
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="muted"
                    onClick={() =>
                      interaction.onCopy({
                        kind: "file",
                        folderPath: node.path,
                        fileName: file,
                      })
                    }
                  >
                    copy
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
          {node.children.length === 0 && node.files.length === 0 ? (
            <EmptyFolderRow folderPath={node.path} interaction={interaction} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmptyFolderRow({
  folderPath,
  interaction,
}: {
  folderPath: string;
  interaction: TreeInteraction;
}) {
  const row = emptyRowId(folderPath);
  return (
    <ContextMenu
      onOpenChange={(open) =>
        interaction.onContextMenuChange(open ? row : null)
      }
    >
      <ContextMenuTrigger
        render={
          <div
            className={cn(
              interaction.rowHighlight(row, false),
              "text-sm text-muted-foreground",
            )}
            onMouseEnter={() => interaction.onFocusRow(row)}
            onClick={() => interaction.onFocusRow(row)}
          >
            <span className="pl-6">(no file)</span>
          </div>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem
          variant="muted"
          onClick={() => {
            interaction.onSetNameInput("");
            interaction.onOpenDialog({
              type: "add-subfolder",
              parentPath: folderPath,
            });
          }}
        >
          add folder
        </ContextMenuItem>
        <ContextMenuItem
          variant="muted"
          onClick={() => {
            interaction.onSetNameInput("");
            interaction.onOpenDialog({ type: "add-file", folderPath });
          }}
        >
          add file
        </ContextMenuItem>
        <ContextMenuItem
          variant="muted"
          disabled={!interaction.clipboard}
          onClick={() => interaction.onPaste(folderPath)}
        >
          paste
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function FileTreePane({
  folders,
  selectedFolderPath,
  selectedFileName,
  onSelectFile,
  onRefresh,
  onOpenPurpose,
}: Props) {
  const treeRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [contextMenuTargetId, setContextMenuTargetId] = useState<string | null>(
    null,
  );
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<TreeClipboard>(null);

  const projectFolderPaths = useMemo(
    () => collectProjectFolderPaths(folders),
    [folders],
  );

  const filteredFolders = useMemo(
    () => filterWorkspaceTree(folders, filter),
    [folders, filter],
  );

  const emphasizedFolderPaths = useMemo(() => {
    if (!selectedFolderPath) return new Set<string>();
    return new Set(getAncestorFolderPaths(selectedFolderPath));
  }, [selectedFolderPath]);

  const visibleRows = useMemo(
    () =>
      buildVisibleRows(filteredFolders, expanded, emphasizedFolderPaths),
    [filteredFolders, expanded, emphasizedFolderPaths],
  );

  const toggleExpanded = useCallback((folderPath: string, isOpen: boolean) => {
    setExpanded((prev) => ({ ...prev, [folderPath]: !isOpen }));
  }, []);

  const postJson = useCallback(async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Request failed: ${res.status}`);
    }
    return res.json();
  }, []);

  const showPaneError = useCallback((message: string) => {
    setError(message);
  }, []);

  const clearSelectionIfUnderPath = useCallback(
    (folderPath: string) => {
      if (
        selectedFolderPath === folderPath ||
        selectedFolderPath.startsWith(`${folderPath}/`)
      ) {
        onSelectFile("", "");
      }
    },
    [onSelectFile, selectedFolderPath],
  );

  const handleInternalDrop = useCallback(
    async (targetPath: string, payload: InternalDragPayload) => {
      if (payload.kind === "file") {
        if (payload.folderPath === targetPath) {
          return;
        }
        if (getProjectRoot(payload.folderPath) !== getProjectRoot(targetPath)) {
          throw new Error("Cannot move items across project folders");
        }
        await postJson("/api/workspace/move-file", {
          fromFolderId: payload.folderPath,
          fromName: payload.fileName,
          toFolderId: targetPath,
        });
        if (
          selectedFolderPath === payload.folderPath &&
          selectedFileName === payload.fileName
        ) {
          onSelectFile(targetPath, payload.fileName);
        }
        return;
      }

      if (
        payload.folderPath === targetPath ||
        isDescendantPath(payload.folderPath, targetPath)
      ) {
        throw new Error("Cannot move a folder into itself or its descendant");
      }
      if (getProjectRoot(payload.folderPath) !== getProjectRoot(targetPath)) {
        throw new Error("Cannot move items across project folders");
      }
      const folderName = getFolderBaseName(payload.folderPath);
      const toPath = `${targetPath}/${folderName}`;
      const result = (await postJson("/api/workspace/rename-folder", {
        fromPath: payload.folderPath,
        toPath,
      })) as { newPath?: string };
      const newPath = result.newPath ?? toPath;
      setExpanded((prev) => {
        const next: Record<string, boolean> = {};
        for (const [key, value] of Object.entries(prev)) {
          next[remapFolderPath(key, payload.folderPath, newPath)] = value;
        }
        return next;
      });
      if (
        selectedFolderPath === payload.folderPath ||
        selectedFolderPath.startsWith(`${payload.folderPath}/`)
      ) {
        onSelectFile(
          remapFolderPath(selectedFolderPath, payload.folderPath, newPath),
          selectedFileName,
        );
      }
    },
    [
      onSelectFile,
      postJson,
      selectedFileName,
      selectedFolderPath,
    ],
  );

  const handleDropOnFolder = useCallback(
    async (folderPath: string, event: React.DragEvent) => {
      setDropTargetPath(null);
      setBusy(true);
      try {
        const internalRaw = event.dataTransfer.getData(INTERNAL_DRAG_MIME);
        if (internalRaw) {
          const payload = JSON.parse(internalRaw) as InternalDragPayload;
          await handleInternalDrop(folderPath, payload);
          setExpanded((prev) => ({ ...prev, [folderPath]: true }));
          await onRefresh();
          return;
        }

        if (event.dataTransfer.items.length > 0) {
          await importOsItems(postJson, event.dataTransfer.items, folderPath);
          setExpanded((prev) => ({ ...prev, [folderPath]: true }));
          await onRefresh();
          return;
        }

        for (const file of Array.from(event.dataTransfer.files)) {
          const text = await file.text();
          await postJson("/api/workspace/create-file", {
            folderId: folderPath,
            fileName: file.name,
            content: text,
          });
        }
        setExpanded((prev) => ({ ...prev, [folderPath]: true }));
        await onRefresh();
      } catch (err) {
        showPaneError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [handleInternalDrop, onRefresh, postJson, showPaneError],
  );

  const handlePaste = useCallback(
    async (targetFolderPath: string) => {
      if (!clipboard) return;
      setBusy(true);
      try {
        if (clipboard.kind === "file") {
          const params = new URLSearchParams({
            folderId: clipboard.folderPath,
            fileName: clipboard.fileName,
          });
          const res = await fetch(
            `/api/workspace/read-file?${params.toString()}`,
          );
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(data.error ?? "Failed to read file");
          }
          const data = (await res.json()) as { content?: string };
          await postJson("/api/workspace/create-file", {
            folderId: targetFolderPath,
            fileName: clipboard.fileName,
            content: data.content ?? "",
          });
        } else {
          await postJson("/api/workspace/copy-folder", {
            fromPath: clipboard.folderPath,
            toParentPath: targetFolderPath,
          });
        }
        setExpanded((prev) => ({ ...prev, [targetFolderPath]: true }));
        await onRefresh();
      } catch (err) {
        showPaneError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [clipboard, onRefresh, postJson, showPaneError],
  );

  const openDialog = useCallback((mode: DialogMode) => {
    setDialogError(null);
    setDialog(mode);
  }, []);

  const handleNameInputChange = useCallback((value: string) => {
    setDialogError(null);
    setNameInput(value);
  }, []);

  const openAddFolder = useCallback(() => {
    setError(null);
    setNameInput("");
    openDialog({ type: "add-folder" });
  }, [openDialog]);

  const fillUntitledFolderName = useCallback(() => {
    setDialogError(null);
    setNameInput(suggestUntitledFolderName(projectFolderPaths));
  }, [projectFolderPaths]);

  const fillAiRenameSuggestion = useCallback(async (folderPath: string) => {
    setBusy(true);
    setDialogError(null);
    try {
      const res = await fetch("/api/workspace/suggest-folder-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folderPath }),
      });
      if (!res.ok) {
        throw new Error("AI 自動入力に失敗しました");
      }
      const data = (await res.json()) as { name?: string };
      const suggested = data.name ?? suggestFolderSlug(folderPath);
      const eventDate = resolveEventDatePrefix(folderPath);
      setNameInput(applyEventDateToSuggestedName(suggested, eventDate));
    } catch {
      setDialogError("AI 自動入力に失敗しました");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDialogConfirm = useCallback(async () => {
    if (!dialog || busy) return;
    const name = nameInput.trim();
    if (!name && dialog.type !== "delete-folder" && dialog.type !== "delete-file") {
      return;
    }

    setBusy(true);
    setDialogError(null);
    try {
      switch (dialog.type) {
        case "add-folder":
          await postJson("/api/workspace/create-folder", { name });
          setExpanded((prev) => ({ ...prev, [name]: true }));
          setDialog(null);
          await onRefresh();
          return;
        case "add-subfolder": {
          const result = (await postJson("/api/workspace/create-folder", {
            parentPath: dialog.parentPath,
            name,
          })) as { path?: string };
          const childPath = result.path ?? `${dialog.parentPath}/${name}`;
          setExpanded((prev) => ({
            ...prev,
            [dialog.parentPath]: true,
            [childPath]: true,
          }));
          setDialog(null);
          await onRefresh();
          return;
        }
        case "rename-folder": {
          const originalName = getFolderBaseName(dialog.folderPath);
          if (name === originalName) {
            setDialogError(NO_CHANGE_MESSAGE);
            return;
          }
          const toPath = buildRenamedFolderPath(dialog.folderPath, name);
          const result = (await postJson("/api/workspace/rename-folder", {
            fromPath: dialog.folderPath,
            toPath,
          })) as { newPath?: string };
          const newPath = result.newPath ?? toPath;
          setExpanded((prev) => {
            const next: Record<string, boolean> = {};
            for (const [key, value] of Object.entries(prev)) {
              next[remapFolderPath(key, dialog.folderPath, newPath)] = value;
            }
            return next;
          });
          await onRefresh();
          if (selectedFolderPath === dialog.folderPath) {
            onSelectFile(
              remapFolderPath(selectedFolderPath, dialog.folderPath, newPath),
              selectedFileName,
            );
          } else if (selectedFolderPath.startsWith(`${dialog.folderPath}/`)) {
            onSelectFile(
              remapFolderPath(selectedFolderPath, dialog.folderPath, newPath),
              selectedFileName,
            );
          }
          setDialog(null);
          return;
        }
        case "delete-folder":
          await postJson("/api/workspace/delete-folder", {
            folderId: dialog.folderPath,
          });
          clearSelectionIfUnderPath(dialog.folderPath);
          setDialog(null);
          await onRefresh();
          return;
        case "add-file":
          await postJson("/api/workspace/create-file", {
            folderId: dialog.folderPath,
            fileName: name,
          });
          onSelectFile(dialog.folderPath, name);
          setDialog(null);
          await onRefresh();
          return;
        case "rename-file": {
          if (name === dialog.fileName) {
            setDialogError(NO_CHANGE_MESSAGE);
            return;
          }
          const result = (await postJson("/api/workspace/rename-file", {
            folderId: dialog.folderPath,
            fromName: dialog.fileName,
            toName: name,
          })) as { newName?: string };
          if (
            selectedFolderPath === dialog.folderPath &&
            selectedFileName === dialog.fileName
          ) {
            onSelectFile(dialog.folderPath, result.newName ?? name);
          }
          setDialog(null);
          await onRefresh();
          return;
        }
        case "delete-file":
          await postJson("/api/workspace/delete-file", {
            folderId: dialog.folderPath,
            fileName: dialog.fileName,
          });
          if (
            selectedFolderPath === dialog.folderPath &&
            selectedFileName === dialog.fileName
          ) {
            onSelectFile(dialog.folderPath, "");
          }
          setDialog(null);
          await onRefresh();
          return;
      }
    } catch (err) {
      setDialogError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    clearSelectionIfUnderPath,
    dialog,
    nameInput,
    onRefresh,
    onSelectFile,
    postJson,
    selectedFileName,
    selectedFolderPath,
  ]);

  const handleDialogSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (busy || !nameInput.trim()) return;
      void handleDialogConfirm();
    },
    [busy, handleDialogConfirm, nameInput],
  );

  const getFocusedRow = useCallback((): TreeRow | null => {
    if (!focusedRowId) return null;
    return visibleRows.find((row) => row.id === focusedRowId) ?? null;
  }, [focusedRowId, visibleRows]);

  const collapseFolder = useCallback(
    (folderPath: string) => {
      setExpanded((prev) => ({ ...prev, [folderPath]: false }));
    },
    [],
  );

  const handleTreeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (dialog) return;

      const row = getFocusedRow();

      if (event.ctrlKey && event.key.toLowerCase() === "c") {
        if (!row || row.kind === "empty" || (row.kind === "folder" && isProjectFolder(row.folderPath))) {
          return;
        }
        event.preventDefault();
        if (row.kind === "file" && row.fileName) {
          setClipboard({
            kind: "file",
            folderPath: row.folderPath,
            fileName: row.fileName,
          });
        } else if (row.kind === "folder") {
          setClipboard({ kind: "folder", folderPath: row.folderPath });
        }
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "v") {
        if (!row || !clipboard || row.kind === "file") return;
        const target =
          row.kind === "empty" ? row.folderPath : row.folderPath;
        event.preventDefault();
        void handlePaste(target);
        return;
      }

      if (event.key === "Delete") {
        if (!row || row.kind === "empty") return;
        event.preventDefault();
        if (row.kind === "file" && row.fileName) {
          openDialog({
            type: "delete-file",
            folderPath: row.folderPath,
            fileName: row.fileName,
          });
        } else if (row.kind === "folder") {
          openDialog({ type: "delete-folder", folderPath: row.folderPath });
        }
        return;
      }

      if (event.key === "F2") {
        if (!row || row.kind === "empty") return;
        event.preventDefault();
        if (row.kind === "file" && row.fileName) {
          setNameInput(row.fileName);
          openDialog({
            type: "rename-file",
            folderPath: row.folderPath,
            fileName: row.fileName,
          });
        } else if (row.kind === "folder") {
          setNameInput(getFolderBaseName(row.folderPath));
          openDialog({ type: "rename-folder", folderPath: row.folderPath });
        }
        return;
      }

      if (visibleRows.length === 0) return;

      const index = focusedRowId
        ? visibleRows.findIndex((r) => r.id === focusedRowId)
        : -1;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = Math.min(
          index < 0 ? 0 : index + 1,
          visibleRows.length - 1,
        );
        setFocusedRowId(visibleRows[next]?.id ?? null);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const next = Math.max(index < 0 ? 0 : index - 1, 0);
        setFocusedRowId(visibleRows[next]?.id ?? null);
        return;
      }

      if (!row) return;

      if (event.key === "Enter") {
        event.preventDefault();
        if (row.kind === "folder") {
          const isOpen =
            expanded[row.folderPath] ??
            emphasizedFolderPaths.has(row.folderPath);
          toggleExpanded(row.folderPath, isOpen);
        } else if (row.kind === "file" && row.fileName) {
          onSelectFile(row.folderPath, row.fileName);
        }
        return;
      }

      if (event.key === "ArrowRight" && row.kind === "folder") {
        const isOpen =
          expanded[row.folderPath] ?? emphasizedFolderPaths.has(row.folderPath);
        if (!isOpen) {
          event.preventDefault();
          setExpanded((prev) => ({ ...prev, [row.folderPath]: true }));
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "Backspace") {
        event.preventDefault();
        const parentPath =
          row.kind === "folder"
            ? getParentFolderPath(row.folderPath)
            : row.folderPath;
        if (parentPath) {
          collapseFolder(parentPath);
        }
      }
    },
    [
      clipboard,
      collapseFolder,
      dialog,
      emphasizedFolderPaths,
      expanded,
      focusedRowId,
      getFocusedRow,
      handlePaste,
      onSelectFile,
      openDialog,
      toggleExpanded,
      visibleRows,
    ],
  );

  const rowHighlight = useCallback(
    (rowId: string, isFileSelected: boolean) => {
      const isFocused = focusedRowId === rowId;
      const isContext = contextMenuTargetId === rowId;
      const showBg = isFocused || isContext;
      return cn(
        "flex items-center gap-1 rounded-md px-1 py-0.5 text-sm",
        isFileSelected && "bg-workspace-tree-row font-semibold",
        !isFileSelected &&
          showBg &&
          "bg-workspace-tree-row",
        !isFileSelected &&
          !showBg &&
          "hover:bg-workspace-tree-row",
      );
    },
    [contextMenuTargetId, focusedRowId],
  );

  const canPaste = useCallback(
    (row: TreeRow) => row.kind !== "file" && clipboard !== null,
    [clipboard],
  );

  const interaction: TreeInteraction = useMemo(
    () => ({
      focusedRowId,
      contextMenuTargetId,
      dropTargetPath,
      clipboard,
      selectedFolderPath,
      selectedFileName,
      onFocusRow: setFocusedRowId,
      onContextMenuChange: setContextMenuTargetId,
      onSetDropTarget: setDropTargetPath,
      onClearDropTarget: () => setDropTargetPath(null),
      onDrop: handleDropOnFolder,
      onCopy: setClipboard,
      onPaste: (target) => void handlePaste(target),
      onOpenDialog: openDialog,
      onSetNameInput: handleNameInputChange,
      onToggleExpanded: toggleExpanded,
      onSelectFile,
      rowHighlight,
      canPaste,
    }),
    [
      canPaste,
      clipboard,
      contextMenuTargetId,
      dropTargetPath,
      focusedRowId,
      handleDropOnFolder,
      handleNameInputChange,
      handlePaste,
      onSelectFile,
      openDialog,
      rowHighlight,
      selectedFileName,
      selectedFolderPath,
      toggleExpanded,
    ],
  );

  const showAiRenameAutoFill =
    dialog?.type === "rename-folder" && !dialog.folderPath.includes("/");

  const deleteFolderDescription =
    dialog?.type === "delete-folder"
      ? isProjectFolder(dialog.folderPath)
        ? `フォルダ「${dialog.folderPath}」を削除しますか？（空フォルダのみ）`
        : `フォルダ「${dialog.folderPath}」と配下のすべてのファイル・フォルダが削除されます。続行しますか？`
      : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-3 py-0">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-md text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="EBE Purpose を開く"
          onClick={() => onOpenPurpose?.()}
        >
          <Image
            src={logoSmall}
            alt=""
            width={logoSmall.width}
            height={logoSmall.height}
            className="h-6 w-auto shrink-0"
            priority
          />
          <span className="text-lg font-semibold tracking-tight">EBEX</span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="フォルダ追加"
            onClick={openAddFolder}
          >
            <FolderPlus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <div className="relative min-w-0 flex-1">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="検索..."
            className="h-8 pr-8"
          />
          {filter ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute inset-y-0 right-0.5 my-auto"
              aria-label="検索をクリア"
              onMouseDown={(e) => {
                e.preventDefault();
                setFilter("");
              }}
              onClick={() => setFilter("")}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1 text-sm text-destructive">
            {error}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss error"
            onClick={() => setError(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <div
        ref={treeRef}
        tabIndex={0}
        className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto px-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onKeyDown={handleTreeKeyDown}
        onMouseDown={() => treeRef.current?.focus()}
      >
        {filteredFolders.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            フォルダがありません
          </p>
        ) : (
          filteredFolders.map((folder) => (
            <TreeNode
              key={folder.path}
              node={folder}
              depth={0}
              expanded={expanded}
              emphasizedFolderPaths={emphasizedFolderPaths}
              interaction={interaction}
            />
          ))
        )}
      </div>

      <Dialog
        open={
          dialog !== null &&
          dialog.type !== "delete-folder" &&
          dialog.type !== "delete-file"
        }
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <form className="flex flex-col gap-4" onSubmit={handleDialogSubmit}>
            <DialogHeader>
              <DialogTitle>
                {dialog?.type === "add-folder" && "フォルダ追加"}
                {dialog?.type === "add-subfolder" && "サブフォルダ追加"}
                {dialog?.type === "rename-folder" && "フォルダリネーム"}
                {dialog?.type === "add-file" && "ファイル追加"}
                {dialog?.type === "rename-file" && "ファイルリネーム"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="name-input">名前</Label>
              <Input
                id="name-input"
                value={nameInput}
                disabled={busy}
                onChange={(e) => handleNameInputChange(e.target.value)}
              />
              {dialogError ? (
                <p className="text-xs text-destructive">{dialogError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDialog(null)}
              >
                キャンセル
              </Button>
              {dialog?.type === "add-folder" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={fillUntitledFolderName}
                >
                  自動入力
                </Button>
              ) : null}
              {showAiRenameAutoFill ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    dialog?.type === "rename-folder" &&
                    void fillAiRenameSuggestion(dialog.folderPath)
                  }
                >
                  AI 自動入力
                </Button>
              ) : null}
              <Button type="submit" disabled={busy || !nameInput.trim()}>
                確定
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={
          dialog?.type === "delete-folder" || dialog?.type === "delete-file"
        }
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除の確認</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.type === "delete-folder"
                ? deleteFolderDescription
                : dialog?.type === "delete-file"
                  ? `ファイル「${dialog.fileName}」を削除しますか？`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDialogConfirm()}>
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
