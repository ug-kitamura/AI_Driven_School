"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  CircleDashed,
  ClipboardPaste,
  Copy,
  FilePlus,
  FolderOpen,
  FolderPlus,
  MessageSquarePlus,
  Pencil,
  Search,
  Star,
  StarOff,
  Trash2,
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
  extractEventDatePrefix,
  suggestUntitledFolderName,
} from "@/lib/workspace-folder-name";
import { aiRequestHeaders } from "@/lib/agent-request-headers";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";
import {
  FILE_ICON_COMPONENTS,
  getFileIconColorClass,
  resolveFileIconCategory,
} from "@/lib/workspace-file-icon";
import {
  AGENT_BUSY_FOLDER_ERROR,
  isAgentLockedProjectFolder,
} from "@/lib/agent/active-project-folders";
import { suggestFolderSlug } from "@/lib/workspace-slug";
import {
  buildRenamedFolderPath,
  collectProjectFolderPaths,
  filterWorkspaceTree,
  filterWorkspaceTreeByFileKeys,
  getAncestorFolderPaths,
  getFolderBaseName,
  remapFolderPath,
} from "@/lib/workspace-tree";
import {
  favoriteKey,
  filterFavoritesToExisting,
  listFavoritesUnderFolder,
  type FavoriteEntry,
} from "@/lib/workspace-favorites";
import { NO_FILE_SENTINEL } from "@/lib/workspace-file-selection";
import {
  INTERNAL_DRAG_MIME,
  internalDragProjectMime,
  type InternalDragPayload,
} from "@/lib/workspace-constants";
import {
  buildVisibleRows,
  emptyRowId,
  fileRowId,
  folderRowId,
  resolveHomeEndNavigation,
  resolveLeftNavigation,
  resolvePasteTarget,
  resolveSelectedFileRowId,
} from "@/lib/workspace-tree-flatten";
import type { TreeRow } from "@/lib/workspace-tree-flatten";
import {
  getParentFolderPath,
  getProjectRoot,
  isDescendantPath,
  isProjectFolder,
} from "@/lib/workspace-tree-path";
import logoSmall from "@/images/logo_small.png";

const NO_CHANGE_MESSAGE = "名前が変更されていません";
const AUTO_RENAME_ON_CONFLICT = { autoRenameOnConflict: true } as const;

type Props = {
  folders: WorkspaceTreeNode[];
  selectedFolderPath: string;
  selectedFileName: string;
  onSelectFile: (folderPath: string, fileName: string) => void;
  /** ファイルを Agent チャットの添付チップへ追加する */
  onAddFileToChat?: (folderPath: string, fileName: string) => void;
  /** Agent チャットの対象プロジェクトフォルダ ID（add to chat の可否判定） */
  chatProjectFolderId?: string;
  onRefresh: () => Promise<void>;
  onOpenPurpose?: () => void;
  /** Agent 実行中のプロジェクトフォルダ ID。該当フォルダの rename/delete を拒否する */
  agentBusyProjectFolderId?: string | null;
};

const CONTENT_SEARCH_DEBOUNCE_MS = 300;

type DialogMode =
  | { type: "add-folder" }
  | { type: "add-subfolder"; parentPath: string }
  | { type: "rename-folder"; folderPath: string }
  | { type: "delete-folder"; folderPath: string }
  | {
      type: "blocked-delete-favorite";
      /** ブロック対象の表示ラベル（ファイル名またはフォルダパス） */
      target: string;
      isFolder: boolean;
      favorites: FavoriteEntry[];
    }
  | { type: "blocked-agent-busy-folder"; folderPath: string }
  | { type: "add-file"; folderPath: string }
  | { type: "rename-file"; folderPath: string; fileName: string }
  | { type: "delete-file"; folderPath: string; fileName: string }
  | null;

type TreeClipboard =
  | { kind: "file"; folderPath: string; fileName: string }
  | { kind: "folder"; folderPath: string }
  | null;

type TreeInteraction = {
  focusedRowId: string | null;
  contextMenuTargetId: string | null;
  dropTargetPath: string | null;
  clipboard: TreeClipboard;
  selectedFolderPath: string;
  selectedFileName: string;
  chatProjectFolderId: string;
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
  /** コンテキストメニュー操作直後のポインター開閉（誤 dblclick 等）を無視する */
  shouldIgnorePointerToggle: () => boolean;
  onSelectFile: (folderPath: string, fileName: string) => void;
  onAddFileToChat: (folderPath: string, fileName: string) => void;
  onOpenDeleteFolderDialog: (folderPath: string) => void;
  onRevealInOs: (folderPath: string, fileName?: string) => void;
  isFavorite: (folderPath: string, fileName: string) => boolean;
  onToggleFavorite: (folderPath: string, fileName: string) => void;
  rowHighlight: (rowId: string, isFileSelected: boolean) => string;
};

/** メニュー操作とフォーカス用クリックが dblclick になるのを防ぐ */
const POINTER_TOGGLE_SUPPRESS_MS = 1000;

function dialogFolderPath(dialog: DialogMode): string | null {
  if (!dialog) return null;
  if (
    dialog.type === "rename-folder" ||
    dialog.type === "add-file" ||
    dialog.type === "delete-folder" ||
    dialog.type === "blocked-agent-busy-folder"
  ) {
    return dialog.folderPath;
  }
  if (dialog.type === "add-subfolder") {
    return dialog.parentPath;
  }
  return null;
}

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
    ...AUTO_RENAME_ON_CONFLICT,
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
    ...AUTO_RENAME_ON_CONFLICT,
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

function TreeNode({
  node,
  depth,
  expanded,
  emphasizedFolderPaths,
  interaction,
}: TreeNodeProps) {
  const isOpen = expanded[node.path] ?? emphasizedFolderPaths.has(node.path);
  const folderRow = folderRowId(node.path);
  const isDropTarget = interaction.dropTargetPath === node.path;
  const isSubfolder = !isProjectFolder(node.path);
  // 現在選択中のファイル（no file 含む）を配下に持つプロジェクトフォルダ全体を、
  // 展開状態に関わらず器で囲んで「作業中プロジェクト」を一目で示す
  const isSelectedProjectRoot =
    !isSubfolder &&
    interaction.selectedFolderPath !== "" &&
    getProjectRoot(interaction.selectedFolderPath) === node.path;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg",
        isDropTarget && "ring-2 ring-primary",
        // 背景は変えず、ブロック左辺に primary 色の縦レールで現在地を示す。
        // DnD 中は青枠（箱）が主役になるためレールは出さない
        isSelectedProjectRoot &&
          !isDropTarget &&
          "before:absolute before:inset-y-0 before:-left-0.5 before:w-[3px] before:rounded-full before:bg-primary before:content-['']",
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
              data-row-id={folderRow}
              tabIndex={-1}
              aria-expanded={isOpen}
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
              onClick={() => interaction.onFocusRow(folderRow)}
              onDoubleClick={(event) => {
                if (interaction.shouldIgnorePointerToggle()) {
                  event.preventDefault();
                  return;
                }
                interaction.onToggleExpanded(node.path, isOpen);
              }}
            >
              <button
                type="button"
                tabIndex={-1}
                className="flex size-5 shrink-0 items-center justify-center outline-none"
                onPointerDown={(event) => {
                  if (interaction.shouldIgnorePointerToggle()) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (interaction.shouldIgnorePointerToggle()) return;
                  interaction.onToggleExpanded(node.path, isOpen);
                }}
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
              interaction.onSetNameInput(getFolderBaseName(node.path));
              interaction.onOpenDialog({
                type: "rename-folder",
                folderPath: node.path,
              });
            }}
          >
            <Pencil className="size-4" />
            rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              interaction.onSetNameInput("");
              interaction.onOpenDialog({
                type: "add-file",
                folderPath: node.path,
              });
            }}
          >
            <FilePlus className="size-4" />
            add file
          </ContextMenuItem>
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
            <FolderPlus className="size-4" />
            add folder
          </ContextMenuItem>
          {isSubfolder ? (
            <ContextMenuItem
              variant="muted"
              onClick={() =>
                interaction.onCopy({ kind: "folder", folderPath: node.path })
              }
            >
              <Copy className="size-4" />
              copy
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem
            variant="muted"
            disabled={!interaction.clipboard}
            onClick={() => interaction.onPaste(node.path)}
          >
            <ClipboardPaste className="size-4" />
            paste
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => interaction.onRevealInOs(node.path)}
          >
            <FolderOpen className="size-4" />
            open explorer
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => interaction.onOpenDeleteFolderDialog(node.path)}
          >
            <Trash2 className="size-4" />
            delete
          </ContextMenuItem>
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
                      data-row-id={row}
                      tabIndex={-1}
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
                        // dragover 中は getData 不可のため、所属プロジェクトを
                        // MIME タイプ名に埋め込んでドロップ先の可否判定に使う
                        event.dataTransfer.setData(
                          internalDragProjectMime(getProjectRoot(node.path)),
                          "",
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
                      onClick={() => interaction.onFocusRow(row)}
                    >
                      <FileRowIcon fileName={file} />
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left outline-none"
                        onClick={() => {
                          interaction.onFocusRow(row);
                          interaction.onSelectFile(node.path, file);
                        }}
                      >
                        {file}
                      </button>
                      {interaction.isFavorite(node.path, file) ? (
                        <Star
                          className="size-3.5 shrink-0 fill-yellow-500 text-yellow-500"
                          aria-hidden="true"
                        />
                      ) : null}
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
                    <Pencil className="size-4" />
                    rename
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
                    <Copy className="size-4" />
                    copy
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="muted"
                    disabled={!interaction.clipboard}
                    onClick={() => interaction.onPaste(node.path)}
                  >
                    <ClipboardPaste className="size-4" />
                    paste
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="muted"
                    disabled={
                      !interaction.chatProjectFolderId ||
                      getProjectRoot(node.path) !==
                        interaction.chatProjectFolderId
                    }
                    onClick={() => interaction.onAddFileToChat(node.path, file)}
                  >
                    <MessageSquarePlus className="size-4" />
                    add to chat
                  </ContextMenuItem>
                  {interaction.isFavorite(node.path, file) ? (
                    <ContextMenuItem
                      variant="muted"
                      onClick={() =>
                        interaction.onToggleFavorite(node.path, file)
                      }
                    >
                      <StarOff className="size-4" />
                      remove favorite
                    </ContextMenuItem>
                  ) : (
                    <ContextMenuItem
                      variant="muted"
                      onClick={() =>
                        interaction.onToggleFavorite(node.path, file)
                      }
                    >
                      <Star className="size-4" />
                      add favorite
                    </ContextMenuItem>
                  )}
                  <ContextMenuItem
                    variant="muted"
                    onClick={() => interaction.onRevealInOs(node.path, file)}
                  >
                    <FolderOpen className="size-4" />
                    open explorer
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
                    <Trash2 className="size-4" />
                    delete
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
  const isSelected =
    interaction.selectedFolderPath === folderPath &&
    interaction.selectedFileName === NO_FILE_SENTINEL;
  return (
    <ContextMenu
      onOpenChange={(open) =>
        interaction.onContextMenuChange(open ? row : null)
      }
    >
      <ContextMenuTrigger
        render={
          <div
            data-row-id={row}
            tabIndex={-1}
            className={cn(
              interaction.rowHighlight(row, isSelected),
              "text-sm text-muted-foreground",
            )}
            onClick={() =>
              interaction.onSelectFile(folderPath, NO_FILE_SENTINEL)
            }
          >
            <span
              className="flex size-5 shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              <CircleDashed className="size-3.5" />
            </span>
            <span>{NO_FILE_SENTINEL}</span>
          </div>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem
          variant="muted"
          onClick={() => {
            interaction.onSetNameInput("");
            interaction.onOpenDialog({ type: "add-file", folderPath });
          }}
        >
          <FilePlus className="size-4" />
          add file
        </ContextMenuItem>
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
          <FolderPlus className="size-4" />
          add folder
        </ContextMenuItem>
        <ContextMenuItem
          variant="muted"
          disabled={!interaction.clipboard}
          onClick={() => interaction.onPaste(folderPath)}
        >
          <ClipboardPaste className="size-4" />
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
  onAddFileToChat,
  chatProjectFolderId = "",
  onRefresh,
  onOpenPurpose,
  agentBusyProjectFolderId = null,
}: Props) {
  const treeRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const suppressPointerToggleUntilRef = useRef(0);
  const dialogRef = useRef<DialogMode>(null);
  const [filter, setFilter] = useState("");
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  // ユーザーが明示的にカーソルを動かすまで、選択ファイル行への自動追従を続ける
  // focusRow 経由の操作で userMovedFocus が立つ
  const [userMovedFocus, setUserMovedFocus] = useState(false);
  const [lastSyncedSelectionRowId, setLastSyncedSelectionRowId] = useState<
    string | null
  >(null);
  const focusRow = useCallback((rowId: string | null) => {
    setUserMovedFocus(true);
    setFocusedRowId(rowId);
  }, []);
  const [contextMenuTargetId, setContextMenuTargetId] = useState<string | null>(
    null,
  );
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<TreeClipboard>(null);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [contentMatchKeys, setContentMatchKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [contentSearching, setContentSearching] = useState(false);
  const [contentTruncated, setContentTruncated] = useState(false);

  const isContentSearchMode = filter.startsWith("?");
  const contentQuery = isContentSearchMode ? filter.slice(1).trim() : "";
  const nameFilter = isContentSearchMode ? "" : filter;

  const favoriteKeys = useMemo(
    () => new Set(favorites.map(favoriteKey)),
    [favorites],
  );

  const projectFolderPaths = useMemo(
    () => collectProjectFolderPaths(folders),
    [folders],
  );

  const filteredFolders = useMemo(() => {
    let tree = folders;

    if (favoritesOnly) {
      tree =
        favoriteKeys.size > 0
          ? filterWorkspaceTreeByFileKeys(tree, favoriteKeys)
          : [];
    }

    if (isContentSearchMode) {
      if (contentQuery) {
        tree =
          contentMatchKeys.size > 0
            ? filterWorkspaceTreeByFileKeys(tree, contentMatchKeys)
            : [];
      }
    } else {
      tree = filterWorkspaceTree(tree, nameFilter);
    }

    return tree;
  }, [
    contentMatchKeys,
    contentQuery,
    favoriteKeys,
    favoritesOnly,
    folders,
    isContentSearchMode,
    nameFilter,
  ]);

  const emphasizedFolderPaths = useMemo(() => {
    if (!selectedFolderPath) return new Set<string>();
    return new Set(getAncestorFolderPaths(selectedFolderPath));
  }, [selectedFolderPath]);

  const visibleRows = useMemo(
    () => buildVisibleRows(filteredFolders, expanded, emphasizedFolderPaths),
    [filteredFolders, expanded, emphasizedFolderPaths],
  );

  // selectedFolderPath / selectedFileName は localStorage 復元が非同期なため、
  // 選択が確定するたびにカーソルを同期する（useEffect ではなく render 中の条件付き setState）、
  // userMovedFocus 成立後はユーザーのカーソル操作を優先する
  const selectedFileRowId = resolveSelectedFileRowId(
    selectedFolderPath,
    selectedFileName,
  );
  if (!userMovedFocus && lastSyncedSelectionRowId !== selectedFileRowId) {
    setLastSyncedSelectionRowId(selectedFileRowId);
    if (selectedFileRowId && selectedFileRowId !== focusedRowId) {
      setFocusedRowId(selectedFileRowId);
    }
  }

  const toggleExpanded = useCallback((folderPath: string, isOpen: boolean) => {
    setExpanded((prev) => ({ ...prev, [folderPath]: !isOpen }));
  }, []);

  const clearPaneError = useCallback(() => {
    setError(null);
  }, []);

  const isFolderExpanded = useCallback(
    (folderPath: string) =>
      expanded[folderPath] ?? emphasizedFolderPaths.has(folderPath),
    [expanded, emphasizedFolderPaths],
  );

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

  const clearSearchFilter = useCallback(() => {
    clearPaneError();
    setFilter("");
    setContentMatchKeys(new Set());
    setContentSearching(false);
    setContentTruncated(false);
  }, [clearPaneError]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/workspace/favorites");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { favorites?: FavoriteEntry[] };
        if (!cancelled) {
          setFavorites(
            filterFavoritesToExisting(data.favorites ?? [], folders),
          );
        }
      } catch {
        // ignore load errors; favorites are optional UI state
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folders]);

  useEffect(() => {
    if (!isContentSearchMode || !contentQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ q: contentQuery });
          const res = await fetch(
            `/api/workspace/search-content?${params.toString()}`,
          );
          if (!res.ok) {
            setContentMatchKeys(new Set());
            setContentTruncated(false);
            return;
          }
          const data = (await res.json()) as {
            matches?: Array<{ folderPath: string; fileName: string }>;
            truncated?: boolean;
          };
          setContentMatchKeys(
            new Set(
              (data.matches ?? []).map(
                (match) => `${match.folderPath}/${match.fileName}`,
              ),
            ),
          );
          setContentTruncated(Boolean(data.truncated));
        } catch {
          setContentMatchKeys(new Set());
          setContentTruncated(false);
        } finally {
          setContentSearching(false);
        }
      })();
    }, CONTENT_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [contentQuery, isContentSearchMode]);

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
        const result = (await postJson("/api/workspace/move-file", {
          fromFolderId: payload.folderPath,
          fromName: payload.fileName,
          toFolderId: targetPath,
          ...AUTO_RENAME_ON_CONFLICT,
        })) as { newName?: string };
        const movedName = result.newName ?? payload.fileName;
        if (
          selectedFolderPath === payload.folderPath &&
          selectedFileName === payload.fileName
        ) {
          onSelectFile(targetPath, movedName);
        }
        focusRow(fileRowId(targetPath, movedName));
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
        ...AUTO_RENAME_ON_CONFLICT,
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
      focusRow(folderRowId(newPath));
    },
    [focusRow, onSelectFile, postJson, selectedFileName, selectedFolderPath],
  );

  const handleDropOnFolder = useCallback(
    async (folderPath: string, event: React.DragEvent) => {
      setDropTargetPath(null);
      clearPaneError();
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
          focusRow(folderRowId(folderPath));
          await onRefresh();
          return;
        }

        for (const file of Array.from(event.dataTransfer.files)) {
          const text = await file.text();
          await postJson("/api/workspace/create-file", {
            folderId: folderPath,
            fileName: file.name,
            content: text,
            ...AUTO_RENAME_ON_CONFLICT,
          });
        }
        setExpanded((prev) => ({ ...prev, [folderPath]: true }));
        focusRow(folderRowId(folderPath));
        await onRefresh();
      } catch (err) {
        showPaneError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [
      clearPaneError,
      focusRow,
      handleInternalDrop,
      onRefresh,
      postJson,
      showPaneError,
    ],
  );

  const handlePaste = useCallback(
    async (targetFolderPath: string) => {
      if (!clipboard) return;
      clearPaneError();
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
          const result = (await postJson("/api/workspace/create-file", {
            folderId: targetFolderPath,
            fileName: clipboard.fileName,
            content: data.content ?? "",
            ...AUTO_RENAME_ON_CONFLICT,
          })) as { fileName?: string };
          const pastedFileName = result.fileName ?? clipboard.fileName;
          setExpanded((prev) => ({ ...prev, [targetFolderPath]: true }));
          focusRow(fileRowId(targetFolderPath, pastedFileName));
        } else {
          const result = (await postJson("/api/workspace/copy-folder", {
            fromPath: clipboard.folderPath,
            toParentPath: targetFolderPath,
            ...AUTO_RENAME_ON_CONFLICT,
          })) as { path?: string };
          const pastedPath =
            result.path ??
            `${targetFolderPath}/${getFolderBaseName(clipboard.folderPath)}`;
          setExpanded((prev) => ({ ...prev, [targetFolderPath]: true }));
          focusRow(folderRowId(pastedPath));
        }
        await onRefresh();
      } catch (err) {
        showPaneError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [clearPaneError, clipboard, focusRow, onRefresh, postJson, showPaneError],
  );

  const openDialog = useCallback(
    (mode: DialogMode) => {
      clearPaneError();
      setDialogError(null);
      if (
        mode?.type === "rename-folder" &&
        isAgentLockedProjectFolder(mode.folderPath, agentBusyProjectFolderId)
      ) {
        const blocked = {
          type: "blocked-agent-busy-folder" as const,
          folderPath: mode.folderPath,
        };
        dialogRef.current = blocked;
        setDialog(blocked);
        return;
      }
      // お気に入り登録済みファイルの削除はブロック（メニュー・Delete キー共通の入口）
      if (
        mode?.type === "delete-file" &&
        favoriteKeys.has(
          favoriteKey({ folderPath: mode.folderPath, fileName: mode.fileName }),
        )
      ) {
        const blocked = {
          type: "blocked-delete-favorite" as const,
          target: mode.fileName,
          isFolder: false,
          favorites: [{ folderPath: mode.folderPath, fileName: mode.fileName }],
        };
        dialogRef.current = blocked;
        setDialog(blocked);
        return;
      }
      // メニュー閉鎖直後の誤 toggle で、今開いているフォルダが閉じるのを防ぐ
      if (dialogFolderPath(mode)) {
        suppressPointerToggleUntilRef.current =
          Date.now() + POINTER_TOGGLE_SUPPRESS_MS;
      }
      dialogRef.current = mode;
      setDialog(mode);
    },
    [agentBusyProjectFolderId, clearPaneError, favoriteKeys],
  );

  const openDeleteFolderDialog = useCallback(
    (folderPath: string) => {
      if (isAgentLockedProjectFolder(folderPath, agentBusyProjectFolderId)) {
        openDialog({ type: "blocked-agent-busy-folder", folderPath });
        return;
      }
      const containedFavorites = listFavoritesUnderFolder(
        favorites,
        folderPath,
      );
      if (containedFavorites.length > 0) {
        openDialog({
          type: "blocked-delete-favorite",
          target: folderPath,
          isFolder: true,
          favorites: containedFavorites,
        });
        return;
      }
      openDialog({ type: "delete-folder", folderPath });
    },
    [agentBusyProjectFolderId, favorites, openDialog],
  );

  const handleToggleFavorite = useCallback(
    async (folderPath: string, fileName: string) => {
      clearPaneError();
      const key = favoriteKey({ folderPath, fileName });
      const previous = favorites;
      const wasFavorite = favoriteKeys.has(key);
      setFavorites((current) =>
        wasFavorite
          ? current.filter((entry) => favoriteKey(entry) !== key)
          : [...current, { folderPath, fileName }],
      );
      try {
        const data = (await postJson("/api/workspace/favorites/toggle", {
          folderPath,
          fileName,
        })) as { favorites?: FavoriteEntry[] };
        setFavorites(filterFavoritesToExisting(data.favorites ?? [], folders));
      } catch (err) {
        setFavorites(previous);
        showPaneError(err instanceof Error ? err.message : String(err));
      }
    },
    [clearPaneError, favoriteKeys, favorites, folders, postJson, showPaneError],
  );

  const isFavorite = useCallback(
    (folderPath: string, fileName: string) =>
      favoriteKeys.has(favoriteKey({ folderPath, fileName })),
    [favoriteKeys],
  );

  const handleNameInputChange = useCallback((value: string) => {
    setDialogError(null);
    setNameInput(value);
  }, []);

  const openAddFolder = useCallback(() => {
    setNameInput("");
    openDialog({ type: "add-folder" });
  }, [openDialog]);

  // 展開状態を空にすると、開閉判定が emphasizedFolderPaths（選択中ファイルの
  // 祖先パス）にフォールバックし、選択中ファイルへ至る道だけ開いたまま畳まれる
  const collapseAll = useCallback(() => {
    clearPaneError();
    setExpanded({});
  }, [clearPaneError]);

  const handleFocusRow = useCallback(
    (rowId: string) => {
      clearPaneError();
      focusRow(rowId);
    },
    [clearPaneError, focusRow],
  );

  const handleSelectFile = useCallback(
    (folderPath: string, fileName: string) => {
      clearPaneError();
      if (fileName) {
        const rowId = resolveSelectedFileRowId(folderPath, fileName);
        if (rowId) focusRow(rowId);
      }
      onSelectFile(folderPath, fileName);
    },
    [clearPaneError, focusRow, onSelectFile],
  );

  const handleContextMenuChange = useCallback(
    (rowId: string | null) => {
      setContextMenuTargetId(rowId);
      // Shift+F10 等でメニューを出した直後のクリックが、フォーカス用クリックと
      // 合わさって dblclick 扱いになりフォルダが閉じるのを防ぐ
      suppressPointerToggleUntilRef.current =
        Date.now() + POINTER_TOGGLE_SUPPRESS_MS;
      if (!rowId && treeRef.current) {
        // メニュー閉鎖時の貫通クリックをツリーが受け取らないようにする
        const el = treeRef.current;
        el.style.pointerEvents = "none";
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.style.pointerEvents = "";
          });
        });
      }
      if (rowId) {
        handleFocusRow(rowId);
      }
    },
    [handleFocusRow],
  );

  const shouldIgnorePointerToggle = useCallback(
    () => Date.now() < suppressPointerToggleUntilRef.current,
    [],
  );

  const handleToggleExpanded = useCallback(
    (folderPath: string, isOpen: boolean) => {
      // 当該フォルダのダイアログ表示中は展開状態を変えない
      if (dialogFolderPath(dialogRef.current) === folderPath) return;
      clearPaneError();
      toggleExpanded(folderPath, isOpen);
      focusRow(folderRowId(folderPath));
    },
    [clearPaneError, focusRow, toggleExpanded],
  );

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
        headers: aiRequestHeaders(loadWorkspaceSettings()),
        body: JSON.stringify({ folderId: folderPath }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "AI 自動入力に失敗しました");
      }
      const data = (await res.json()) as { name?: string };
      const suggested = data.name ?? suggestFolderSlug(folderPath);
      const existingDate = extractEventDatePrefix(folderPath);
      setNameInput(
        existingDate
          ? applyEventDateToSuggestedName(suggested, existingDate)
          : suggested,
      );
    } catch (err) {
      setDialogError(
        err instanceof Error ? err.message : "AI 自動入力に失敗しました",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleRevealInOs = useCallback(
    async (folderPath: string, fileName?: string) => {
      clearPaneError();
      try {
        await postJson("/api/workspace/reveal-in-os", {
          folderPath,
          ...(fileName ? { fileName } : {}),
        });
      } catch (err) {
        showPaneError(err instanceof Error ? err.message : String(err));
      }
    },
    [clearPaneError, postJson, showPaneError],
  );

  const handleDialogConfirm = useCallback(async () => {
    if (!dialog || busy) return;
    const name = nameInput.trim();
    if (
      !name &&
      dialog.type !== "delete-folder" &&
      dialog.type !== "delete-file"
    ) {
      return;
    }

    setBusy(true);
    setDialogError(null);
    try {
      switch (dialog.type) {
        case "add-folder":
          await postJson("/api/workspace/create-folder", { name });
          // 選択で強調される祖先展開に関わらず、新規フォルダ自身は閉じたまま
          setExpanded((prev) => ({ ...prev, [name]: false }));
          setDialog(null);
          await onRefresh();
          onSelectFile(name, NO_FILE_SENTINEL);
          focusRow(folderRowId(name));
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
            [childPath]: false,
          }));
          setDialog(null);
          await onRefresh();
          onSelectFile(childPath, NO_FILE_SENTINEL);
          focusRow(folderRowId(childPath));
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
          focusRow(folderRowId(newPath));
          setDialog(null);
          return;
        }
        case "delete-folder": {
          await postJson("/api/workspace/delete-folder", {
            folderId: dialog.folderPath,
          });
          clearSelectionIfUnderPath(dialog.folderPath);
          const parentPath = getParentFolderPath(dialog.folderPath);
          const fallbackRowId = resolveSelectedFileRowId(
            selectedFolderPath,
            selectedFileName,
          );
          focusRow(parentPath ? folderRowId(parentPath) : fallbackRowId);
          setDialog(null);
          await onRefresh();
          return;
        }
        case "add-file": {
          const folderPath = dialog.folderPath;
          await postJson("/api/workspace/create-file", {
            folderId: folderPath,
            fileName: name,
          });
          setExpanded((prev) => ({ ...prev, [folderPath]: true }));
          setDialog(null);
          await onRefresh();
          handleSelectFile(folderPath, name);
          return;
        }
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
          const renamedFileName = result.newName ?? name;
          if (
            selectedFolderPath === dialog.folderPath &&
            selectedFileName === dialog.fileName
          ) {
            onSelectFile(dialog.folderPath, renamedFileName);
          }
          focusRow(fileRowId(dialog.folderPath, renamedFileName));
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
          focusRow(folderRowId(dialog.folderPath));
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
    focusRow,
    handleSelectFile,
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

  const collapseFolder = useCallback((folderPath: string) => {
    if (dialogFolderPath(dialogRef.current) === folderPath) return;
    setExpanded((prev) => ({ ...prev, [folderPath]: false }));
  }, []);

  // dialog の同期 ref（keydown ガード用）。展開状態は変更しない
  useEffect(() => {
    dialogRef.current = dialog;
  }, [dialog]);

  const handleTreeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (dialog || dialogRef.current) return;

      clearPaneError();

      const row = getFocusedRow();

      if (event.ctrlKey && event.key.toLowerCase() === "c") {
        if (
          !row ||
          row.kind === "empty" ||
          (row.kind === "folder" && isProjectFolder(row.folderPath))
        ) {
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
        if (!row || !clipboard) return;
        const target = resolvePasteTarget(row);
        if (!target) return;
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
          openDeleteFolderDialog(row.folderPath);
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

      const resolvedIndex = focusedRowId
        ? visibleRows.findIndex((r) => r.id === focusedRowId)
        : -1;
      const fallbackRowId = resolveSelectedFileRowId(
        selectedFolderPath,
        selectedFileName,
      );
      const fallbackIndex = fallbackRowId
        ? visibleRows.findIndex((r) => r.id === fallbackRowId)
        : -1;
      // focusedRowId が visibleRows に無い場合は選択ファイル行をフォールバックし、
      // それも見つからなければ先頭行を基準にする
      const index = resolvedIndex >= 0 ? resolvedIndex : fallbackIndex;

      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const navigation = resolveHomeEndNavigation(
          visibleRows,
          index < 0 ? 0 : index,
          event.key,
          event.ctrlKey,
        );
        if (navigation.focusRowId) {
          focusRow(navigation.focusRowId);
        }
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = Math.min(
          index < 0 ? 0 : index + 1,
          visibleRows.length - 1,
        );
        focusRow(visibleRows[next]?.id ?? null);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const next = Math.max(index < 0 ? 0 : index - 1, 0);
        focusRow(visibleRows[next]?.id ?? null);
        return;
      }

      if (!row) return;

      if (event.key === "Enter") {
        event.preventDefault();
        if (row.kind === "folder") {
          handleToggleExpanded(
            row.folderPath,
            isFolderExpanded(row.folderPath),
          );
        } else if (row.kind === "file" && row.fileName) {
          handleSelectFile(row.folderPath, row.fileName);
        } else if (row.kind === "empty") {
          handleSelectFile(row.folderPath, NO_FILE_SENTINEL);
        }
        return;
      }

      if (event.key === "ArrowRight" && row.kind === "folder") {
        if (!isFolderExpanded(row.folderPath)) {
          event.preventDefault();
          setExpanded((prev) => ({ ...prev, [row.folderPath]: true }));
          focusRow(folderRowId(row.folderPath));
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "Backspace") {
        event.preventDefault();
        const navigation = resolveLeftNavigation(row, {
          isFolderExpanded,
          isProjectFolder,
          getParentFolderPath,
        });
        if (!navigation) return;
        for (const path of navigation.collapsePaths) {
          collapseFolder(path);
        }
        if (navigation.focusRowId) {
          focusRow(navigation.focusRowId);
        }
      }
    },
    [
      clipboard,
      clearPaneError,
      collapseFolder,
      dialog,
      focusRow,
      focusedRowId,
      getFocusedRow,
      handlePaste,
      handleSelectFile,
      handleToggleExpanded,
      isFolderExpanded,
      openDeleteFolderDialog,
      openDialog,
      selectedFileName,
      selectedFolderPath,
      visibleRows,
    ],
  );

  const rowHighlight = useCallback(
    (rowId: string, isFileSelected: boolean) => {
      const isFocused = focusedRowId === rowId;
      const isContext = contextMenuTargetId === rowId;
      const showBg = isFocused || isContext;
      return cn(
        "flex items-center gap-1 rounded-md px-1 py-0.5 text-sm outline-none",
        isFileSelected && "font-semibold",
        showBg ? "bg-workspace-tree-row" : "hover:bg-workspace-tree-row",
      );
    },
    [contextMenuTargetId, focusedRowId],
  );

  useEffect(() => {
    if (!focusedRowId || !treeRef.current) return;
    const escaped = CSS.escape(focusedRowId);
    const element = treeRef.current.querySelector<HTMLElement>(
      `[data-row-id="${escaped}"]`,
    );
    element?.scrollIntoView({ block: "nearest" });
    element?.focus({ preventScroll: true });
  }, [focusedRowId]);

  const interaction: TreeInteraction = useMemo(
    () => ({
      focusedRowId,
      contextMenuTargetId,
      dropTargetPath,
      clipboard,
      selectedFolderPath,
      selectedFileName,
      chatProjectFolderId,
      onFocusRow: handleFocusRow,
      onContextMenuChange: handleContextMenuChange,
      onSetDropTarget: setDropTargetPath,
      onClearDropTarget: () => setDropTargetPath(null),
      onDrop: handleDropOnFolder,
      onCopy: setClipboard,
      onPaste: (target) => void handlePaste(target),
      onOpenDialog: openDialog,
      onSetNameInput: handleNameInputChange,
      onToggleExpanded: handleToggleExpanded,
      shouldIgnorePointerToggle,
      onSelectFile: handleSelectFile,
      onAddFileToChat: (folderPath, fileName) => {
        onAddFileToChat?.(folderPath, fileName);
      },
      onOpenDeleteFolderDialog: openDeleteFolderDialog,
      onRevealInOs: (folderPath, fileName) => {
        void handleRevealInOs(folderPath, fileName);
      },
      isFavorite,
      onToggleFavorite: (folderPath, fileName) => {
        void handleToggleFavorite(folderPath, fileName);
      },
      rowHighlight,
    }),
    [
      clipboard,
      contextMenuTargetId,
      dropTargetPath,
      focusedRowId,
      handleContextMenuChange,
      handleDropOnFolder,
      handleFocusRow,
      handleNameInputChange,
      handlePaste,
      handleRevealInOs,
      handleSelectFile,
      handleToggleExpanded,
      isFavorite,
      openDeleteFolderDialog,
      openDialog,
      rowHighlight,
      selectedFileName,
      selectedFolderPath,
      chatProjectFolderId,
      onAddFileToChat,
      shouldIgnorePointerToggle,
      handleToggleFavorite,
    ],
  );

  const showAiRenameAutoFill =
    dialog?.type === "rename-folder" && !dialog.folderPath.includes("/");

  const deleteFolderDescription =
    dialog?.type === "delete-folder"
      ? `フォルダ「${getFolderBaseName(dialog.folderPath)}」と配下のすべてのファイル・フォルダが削除されます。実行しますか？`
      : "";

  // ツリー空き領域・検索ボックス行で共通に出すコンテキストメニュー項目
  const treeAreaContextMenuItems = (
    <>
      <ContextMenuItem variant="muted" onClick={openAddFolder}>
        <FolderPlus className="size-4" />
        add folder
      </ContextMenuItem>
      <ContextMenuItem variant="muted" onClick={collapseAll}>
        <ChevronsDownUp className="size-4" />
        collapse all
      </ContextMenuItem>
    </>
  );

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
            aria-label="すべて折りたたむ"
            onClick={collapseAll}
          >
            <ChevronsDownUp className="size-4" />
          </Button>
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

      <div className="relative flex shrink-0 items-center gap-2 px-3 py-2">
        {/* 入力欄以外（余白・アイコン）を右クリック → add folder。
            入力欄はトリガの subtree に入れないことで、ブラウザ標準の
            テキストメニュー（貼り付け等）をそのまま残す（Base UI トリガは
            capture フェーズで native メニューを preventDefault するため、
            子からの stopPropagation では止められない）。 */}
        <ContextMenu>
          <ContextMenuTrigger
            render={<div className="absolute inset-0" aria-hidden="true" />}
          />
          <ContextMenuContent>{treeAreaContextMenuItems}</ContextMenuContent>
        </ContextMenu>
        {/* アイコンはクリックを背景トリガへ透過させる（右クリックで add folder） */}
        <Search className="pointer-events-none relative z-10 size-4 shrink-0 text-muted-foreground" />
        <div className="relative z-10 min-w-0 flex-1">
          <Input
            value={filter}
            onChange={(e) => {
              const value = e.target.value;
              clearPaneError();
              if (!value.startsWith("?") || !value.slice(1).trim()) {
                setContentMatchKeys(new Set());
                setContentSearching(false);
                setContentTruncated(false);
              } else {
                setContentSearching(true);
              }
              setFilter(value);
            }}
            placeholder="Filter files... (? to search contents)"
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
                clearSearchFilter();
              }}
              onClick={clearSearchFilter}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
        {/* お気に入りボタンも右クリックで add folder（左クリックは従来どおり切替） */}
        <ContextMenu>
          <ContextMenuTrigger
            render={
              <Button
                type="button"
                variant={favoritesOnly ? "secondary" : "ghost"}
                size="icon-sm"
                className="relative z-10"
                aria-label={
                  favoritesOnly
                    ? "すべてのファイルを表示"
                    : "お気に入りのみ表示"
                }
                aria-pressed={favoritesOnly}
                onClick={() => {
                  clearPaneError();
                  setFavoritesOnly((prev) => !prev);
                }}
              >
                <Star
                  className={cn(
                    "size-4 text-muted-foreground",
                    favoritesOnly && "fill-yellow-500 text-yellow-500",
                  )}
                />
              </Button>
            }
          />
          <ContextMenuContent>{treeAreaContextMenuItems}</ContextMenuContent>
        </ContextMenu>
      </div>

      {contentSearching ? (
        <p className="px-3 pb-2 text-sm text-muted-foreground">検索中…</p>
      ) : null}
      {!contentSearching && contentTruncated ? (
        <p className="px-3 pb-2 text-sm text-muted-foreground">
          200 件を超える一致がありました。検索を絞り込んでください
        </p>
      ) : null}

      {error ? (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          <AlertCircle className="size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1 text-sm text-destructive">
            {error}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            aria-label="Dismiss error"
            onClick={() => setError(null)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : null}

      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              ref={treeRef}
              tabIndex={0}
              className="workspace-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-1 py-2 outline-none"
              onKeyDown={handleTreeKeyDown}
              onMouseDown={() => {
                if (dialogRef.current) return;
                treeRef.current?.focus();
              }}
            >
              {filteredFolders.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  {contentSearching
                    ? "検索中…"
                    : isContentSearchMode && contentQuery
                      ? "一致するファイルがありません"
                      : favoritesOnly
                        ? "お気に入りがありません"
                        : "フォルダがありません"}
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
              {/* リスト下の余白。上部 padding とこの余白のどちらを右クリックしても
                  ツリー空き領域メニューが出る（行の上では行メニューが内側優先で表示される） */}
              <div className="min-h-6 flex-1" aria-hidden="true" />
            </div>
          }
        />
        <ContextMenuContent>{treeAreaContextMenuItems}</ContextMenuContent>
      </ContextMenu>

      <Dialog
        open={
          dialog !== null &&
          dialog.type !== "delete-folder" &&
          dialog.type !== "delete-file" &&
          dialog.type !== "blocked-delete-favorite" &&
          dialog.type !== "blocked-agent-busy-folder"
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
                  自動命名
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
                  AI 自動命名
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
        open={dialog?.type === "blocked-agent-busy-folder"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>操作できません</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.type === "blocked-agent-busy-folder"
                ? AGENT_BUSY_FOLDER_ERROR
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDialog(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={dialog?.type === "blocked-delete-favorite"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除できません</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.type === "blocked-delete-favorite"
                ? dialog.isFolder
                  ? `フォルダ「${dialog.target}」の配下にお気に入り登録済みのファイルが含まれています。remove favorite で解除してから削除してください。`
                  : `ファイル「${dialog.target}」はお気に入りに登録されています。remove favorite で解除してから削除してください。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialog?.type === "blocked-delete-favorite" && dialog.isFolder ? (
            <ul className="workspace-scrollbar flex max-h-40 flex-col gap-1 overflow-y-auto text-sm text-muted-foreground">
              {dialog.favorites.map((entry) => (
                <li
                  key={favoriteKey(entry)}
                  className="flex items-center gap-1.5"
                >
                  <Star
                    className="size-3.5 shrink-0 fill-yellow-500 text-yellow-500"
                    aria-hidden="true"
                  />
                  <span className="truncate">{favoriteKey(entry)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDialog(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
