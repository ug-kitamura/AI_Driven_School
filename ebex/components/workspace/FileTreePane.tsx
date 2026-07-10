"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import {
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
import { suggestFolderSlug } from "@/lib/workspace-slug";
import {
  collectProjectFolderPaths,
  filterWorkspaceTree,
  getAncestorFolderPaths,
  remapFolderPath,
} from "@/lib/workspace-tree";
import logoSmall from "@/images/logo_small.png";

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

type TreeNodeProps = {
  node: WorkspaceTreeNode;
  depth: number;
  expanded: Record<string, boolean>;
  emphasizedFolderPaths: Set<string>;
  selectedFolderPath: string;
  selectedFileName: string;
  onToggleExpanded: (folderPath: string, isOpen: boolean) => void;
  onSelectFile: (folderPath: string, fileName: string) => void;
  onOpenDialog: (dialog: DialogMode) => void;
  onSetNameInput: (value: string) => void;
  onDrop: (folderPath: string, files: FileList | File[]) => void;
};

function TreeNode({
  node,
  depth,
  expanded,
  emphasizedFolderPaths,
  selectedFolderPath,
  selectedFileName,
  onToggleExpanded,
  onSelectFile,
  onOpenDialog,
  onSetNameInput,
  onDrop,
}: TreeNodeProps) {
  const isOpen = expanded[node.path] ?? emphasizedFolderPaths.has(node.path);
  const isFolderSelected =
    selectedFolderPath === node.path && !selectedFileName;
  const folderEmphasized =
    emphasizedFolderPaths.has(node.path) || isFolderSelected;

  return (
    <div className="flex flex-col">
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              className={cn(
                "flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted",
                (isFolderSelected || folderEmphasized) && "bg-muted",
              )}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (event.dataTransfer.files.length > 0) {
                  void onDrop(node.path, event.dataTransfer.files);
                }
              }}
            >
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center"
                onClick={() => onToggleExpanded(node.path, isOpen)}
                aria-label={isOpen ? "折りたたむ" : "展開する"}
              >
                {isOpen ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm"
                onClick={() => {
                  onToggleExpanded(node.path, isOpen);
                  onSelectFile(node.path, node.files[0] ?? "");
                }}
              >
                {node.name}
              </button>
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              onSetNameInput("notes.md");
              onOpenDialog({ type: "add-file", folderPath: node.path });
            }}
          >
            ファイル追加
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              onSetNameInput("");
              onOpenDialog({ type: "add-subfolder", parentPath: node.path });
            }}
          >
            フォルダ追加
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              onSetNameInput(node.path);
              onOpenDialog({ type: "rename-folder", folderPath: node.path });
            }}
          >
            名前変更
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() =>
              onOpenDialog({ type: "delete-folder", folderPath: node.path })
            }
          >
            削除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isOpen ? (
        <div className="ml-[9px] flex flex-col border-l border-border pl-[7px]">
          {node.files.map((file) => {
            const isFileSelected =
              selectedFolderPath === node.path && selectedFileName === file;
            return (
              <ContextMenu key={file}>
                <ContextMenuTrigger
                  render={
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-md px-1 py-0.5 text-sm hover:bg-muted",
                        isFileSelected && "bg-muted font-semibold",
                      )}
                    >
                      <span className="size-5 shrink-0" aria-hidden="true" />
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left"
                        onClick={() => onSelectFile(node.path, file)}
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
                      onSetNameInput(file);
                      onOpenDialog({
                        type: "rename-file",
                        folderPath: node.path,
                        fileName: file,
                      });
                    }}
                  >
                    名前変更
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() =>
                      onOpenDialog({
                        type: "delete-file",
                        folderPath: node.path,
                        fileName: file,
                      })
                    }
                  >
                    削除
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              emphasizedFolderPaths={emphasizedFolderPaths}
              selectedFolderPath={selectedFolderPath}
              selectedFileName={selectedFileName}
              onToggleExpanded={onToggleExpanded}
              onSelectFile={onSelectFile}
              onOpenDialog={onOpenDialog}
              onSetNameInput={onSetNameInput}
              onDrop={onDrop}
            />
          ))}
        </div>
      ) : null}
    </div>
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const openAddFolder = useCallback(() => {
    setError(null);
    setNameInput("");
    setDialog({ type: "add-folder" });
  }, []);

  const fillUntitledFolderName = useCallback(() => {
    setNameInput(suggestUntitledFolderName(projectFolderPaths));
  }, [projectFolderPaths]);

  const fillAiRenameSuggestion = useCallback(async (folderPath: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/suggest-folder-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folderPath }),
      });
      const data = (await res.json()) as { name?: string };
      const suggested = data.name ?? suggestFolderSlug(folderPath);
      const eventDate = resolveEventDatePrefix(folderPath);
      setNameInput(applyEventDateToSuggestedName(suggested, eventDate));
    } catch {
      const eventDate = resolveEventDatePrefix(folderPath);
      setNameInput(
        applyEventDateToSuggestedName(suggestFolderSlug(folderPath), eventDate),
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDialogConfirm = useCallback(async () => {
    if (!dialog) return;
    setBusy(true);
    setError(null);
    try {
      const name = nameInput.trim();
      switch (dialog.type) {
        case "add-folder":
          await postJson("/api/workspace/create-folder", { name });
          setExpanded((prev) => ({ ...prev, [name]: true }));
          break;
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
          break;
        }
        case "rename-folder": {
          const result = (await postJson("/api/workspace/rename-folder", {
            fromPath: dialog.folderPath,
            toPath: name,
          })) as { newPath?: string };
          const newPath = result.newPath ?? name;
          setExpanded((prev) => {
            const next: Record<string, boolean> = {};
            for (const [key, value] of Object.entries(prev)) {
              next[remapFolderPath(key, dialog.folderPath, newPath)] = value;
            }
            return next;
          });
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
          break;
        }
        case "delete-folder":
          await postJson("/api/workspace/delete-folder", {
            folderId: dialog.folderPath,
          });
          break;
        case "add-file":
          await postJson("/api/workspace/create-file", {
            folderId: dialog.folderPath,
            fileName: name,
          });
          onSelectFile(dialog.folderPath, name);
          break;
        case "rename-file": {
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
          break;
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
          break;
      }
      setDialog(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    dialog,
    nameInput,
    onRefresh,
    onSelectFile,
    postJson,
    selectedFileName,
    selectedFolderPath,
  ]);

  const handleDrop = useCallback(
    async (folderPath: string, files: FileList | File[]) => {
      setBusy(true);
      try {
        for (const file of Array.from(files)) {
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
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [onRefresh, postJson],
  );

  const showAiRenameAutoFill =
    dialog?.type === "rename-folder" && !dialog.folderPath.includes("/");

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
        <p className="px-3 py-2 text-xs text-destructive">{error}</p>
      ) : null}

      <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto px-1 py-2">
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
              selectedFolderPath={selectedFolderPath}
              selectedFileName={selectedFileName}
              onToggleExpanded={toggleExpanded}
              onSelectFile={onSelectFile}
              onOpenDialog={setDialog}
              onSetNameInput={setNameInput}
              onDrop={handleDrop}
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
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
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
            <Button
              type="button"
              disabled={busy || !nameInput.trim()}
              onClick={() => void handleDialogConfirm()}
            >
              確定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={dialog?.type === "delete-folder" || dialog?.type === "delete-file"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除の確認</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.type === "delete-folder"
                ? `フォルダ「${dialog.folderPath}」を削除しますか？（空フォルダのみ）`
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
