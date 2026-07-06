"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FilePlus,
  FolderPlus,
  Pencil,
  Search,
  Trash2,
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
import { cn } from "@/lib/utils";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import type { WorkspaceFolder } from "@/lib/workspace-loader";
import { suggestFolderSlug } from "@/lib/workspace-slug";

type Props = {
  folders: WorkspaceFolder[];
  selectedFolderId: string;
  selectedFileName: string;
  onSelectFile: (folderId: string, fileName: string) => void;
  onRefresh: () => Promise<void>;
};

type DialogMode =
  | { type: "add-folder"; manual: boolean }
  | { type: "rename-folder"; folderId: string; manual: boolean }
  | { type: "delete-folder"; folderId: string }
  | { type: "add-file"; folderId: string }
  | { type: "rename-file"; folderId: string; fileName: string }
  | { type: "delete-file"; folderId: string; fileName: string }
  | null;

export function FileTreePane({
  folders,
  selectedFolderId,
  selectedFileName,
  onSelectFile,
  onRefresh,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropTargetRef = useRef<string | null>(null);

  const filteredFolders = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return folders;
    return folders
      .map((folder) => {
        const folderMatch = folder.id.toLowerCase().includes(q);
        const files = folder.files.filter(
          (f) => folderMatch || f.toLowerCase().includes(q),
        );
        if (folderMatch || files.length > 0) {
          return { ...folder, files: folderMatch ? folder.files : files };
        }
        return null;
      })
      .filter(Boolean) as WorkspaceFolder[];
  }, [folders, filter]);

  const toggleExpanded = useCallback((folderId: string) => {
    setExpanded((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
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

  const openAddFolder = useCallback((manual: boolean) => {
    setError(null);
    setNameInput(manual ? "" : suggestFolderSlug(""));
    setDialog({ type: "add-folder", manual });
  }, []);

  const openRenameFolder = useCallback(
    async (folderId: string, manual: boolean) => {
      setError(null);
      if (manual) {
        setNameInput(folderId);
        setDialog({ type: "rename-folder", folderId, manual: true });
        return;
      }
      setBusy(true);
      try {
        const res = await fetch("/api/workspace/suggest-folder-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId }),
        });
        const data = (await res.json()) as { name?: string };
        setNameInput(data.name ?? suggestFolderSlug(folderId));
        setDialog({ type: "rename-folder", folderId, manual: false });
      } catch {
        setNameInput(suggestFolderSlug(folderId));
        setDialog({ type: "rename-folder", folderId, manual: false });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

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
        case "rename-folder": {
          const result = (await postJson("/api/workspace/rename-folder", {
            fromId: dialog.folderId,
            toId: name,
          })) as { newId?: string };
          const newId = result.newId ?? name;
          if (selectedFolderId === dialog.folderId) {
            onSelectFile(newId, selectedFileName);
          }
          break;
        }
        case "delete-folder":
          await postJson("/api/workspace/delete-folder", {
            folderId: dialog.folderId,
          });
          break;
        case "add-file":
          await postJson("/api/workspace/create-file", {
            folderId: dialog.folderId,
            fileName: name,
          });
          onSelectFile(dialog.folderId, name);
          break;
        case "rename-file": {
          const result = (await postJson("/api/workspace/rename-file", {
            folderId: dialog.folderId,
            fromName: dialog.fileName,
            toName: name,
          })) as { newName?: string };
          if (
            selectedFolderId === dialog.folderId &&
            selectedFileName === dialog.fileName
          ) {
            onSelectFile(dialog.folderId, result.newName ?? name);
          }
          break;
        }
        case "delete-file":
          await postJson("/api/workspace/delete-file", {
            folderId: dialog.folderId,
            fileName: dialog.fileName,
          });
          if (
            selectedFolderId === dialog.folderId &&
            selectedFileName === dialog.fileName
          ) {
            onSelectFile(dialog.folderId, "");
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
    selectedFolderId,
  ]);

  const handleDrop = useCallback(
    async (folderId: string, files: FileList | File[]) => {
      setBusy(true);
      try {
        for (const file of Array.from(files)) {
          const text = await file.text();
          await postJson("/api/workspace/create-file", {
            folderId,
            fileName: file.name,
            content: text,
          });
        }
        setExpanded((prev) => ({ ...prev, [folderId]: true }));
        await onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [onRefresh, postJson],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
        <span className="font-semibold tracking-tight">EBEX</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="フォルダ追加"
            onClick={() => openAddFolder(true)}
          >
            <FolderPlus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b px-2 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="検索..."
          className="h-8"
        />
      </div>

      {error ? (
        <p className="px-3 py-2 text-xs text-destructive">{error}</p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {filteredFolders.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            フォルダがありません
          </p>
        ) : (
          filteredFolders.map((folder) => {
            const isOpen = expanded[folder.id] ?? folder.id === selectedFolderId;
            return (
              <div key={folder.id} className="flex flex-col">
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted/60",
                    selectedFolderId === folder.id && !selectedFileName && "bg-muted",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    dropTargetRef.current = folder.id;
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files.length > 0) {
                      void handleDrop(folder.id, e.dataTransfer.files);
                    }
                  }}
                >
                  <button
                    type="button"
                    className="flex size-6 shrink-0 items-center justify-center"
                    onClick={() => toggleExpanded(folder.id)}
                    aria-label={isOpen ? "折りたたむ" : "展開する"}
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm"
                    onClick={() => {
                      setExpanded((prev) => ({ ...prev, [folder.id]: true }));
                      onSelectFile(folder.id, folder.files[0] ?? "");
                    }}
                  >
                    {folder.id}
                  </button>
                  {folder.hasSubfolders ? (
                    <WorkspaceTooltip
                      label="サブフォルダがあります（v1 では非表示）"
                      render={
                        <span className="inline-flex">
                          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                        </span>
                      }
                    />
                  ) : null}
                  <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="ファイル追加"
                      onClick={() => {
                        setNameInput("notes.md");
                        setDialog({ type: "add-file", folderId: folder.id });
                      }}
                    >
                      <FilePlus className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="リネーム"
                      onClick={() => void openRenameFolder(folder.id, true)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="削除"
                      onClick={() =>
                        setDialog({ type: "delete-folder", folderId: folder.id })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {isOpen ? (
                  <div className="ml-6 flex flex-col">
                    {folder.files.map((file) => (
                      <div
                        key={file}
                        className={cn(
                          "group flex items-center gap-1 rounded-md px-2 py-0.5 text-sm hover:bg-muted/60",
                          selectedFolderId === folder.id &&
                            selectedFileName === file &&
                            "bg-muted font-medium",
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left"
                          onClick={() => onSelectFile(folder.id, file)}
                        >
                          {file}
                        </button>
                        <div className="flex shrink-0 opacity-0 group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="リネーム"
                            onClick={() => {
                              setNameInput(file);
                              setDialog({
                                type: "rename-file",
                                folderId: folder.id,
                                fileName: file,
                              });
                            }}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="削除"
                            onClick={() =>
                              setDialog({
                                type: "delete-file",
                                folderId: folder.id,
                                fileName: file,
                              })
                            }
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <Dialog
        open={dialog !== null && dialog.type !== "delete-folder" && dialog.type !== "delete-file"}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "add-folder" && "フォルダ追加"}
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
            {dialog?.type === "rename-folder" && !dialog.manual ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  dialog &&
                  void openRenameFolder(
                    dialog.type === "rename-folder" ? dialog.folderId : "",
                    false,
                  )
                }
              >
                AI 自動入力
              </Button>
            ) : null}
            {dialog?.type === "add-folder" && !dialog.manual ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNameInput(suggestFolderSlug(""))}
              >
                自動入力
              </Button>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              キャンセル
            </Button>
            <Button type="button" disabled={busy || !nameInput.trim()} onClick={() => void handleDialogConfirm()}>
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
                ? `フォルダ「${dialog.folderId}」を削除しますか？（空フォルダのみ）`
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
