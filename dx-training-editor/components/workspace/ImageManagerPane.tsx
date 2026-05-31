"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  Upload,
  Sparkles,
  Search,
  Link2,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { ImageGrid, type ImageGridItem } from "@/components/workspace/ImageGrid";
import { ImageLightbox } from "@/components/workspace/ImageLightbox";
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
import { buildUsedImageRows } from "@/lib/build-used-image-rows";
import { countImageRefsInSeries } from "@/lib/extract-image-refs";
import {
  toImageMarkdown,
} from "@/lib/image-path";
import type { ImageAsset, Series } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";

type Props = {
  series: Series[];
  pane3Mode: Pane3Mode;
  onInsertImage: (markdown: string) => boolean;
  pane4Open: boolean;
  onTogglePane4: () => void;
};

type Tab = "used" | "upload" | "ai" | "web";

const TABS: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
  { value: "used", label: "Used", icon: <Link2 className="h-3 w-3" /> },
  { value: "upload", label: "UP", icon: <Upload className="h-3 w-3" /> },
  { value: "ai", label: "AI", icon: <Sparkles className="h-3 w-3" /> },
  { value: "web", label: "Web", icon: <Search className="h-3 w-3" /> },
];

type PreviewState = {
  name: string;
  path: string;
  statusLabel?: string;
};

type PendingDelete = ImageGridItem & { referenceCount?: number };

export function ImageManagerPane({
  series,
  pane3Mode,
  onInsertImage,
  pane4Open,
  onTogglePane4,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("used");
  const [stagingFiles, setStagingFiles] = useState<ImageAsset[]>([]);
  const [promotedFiles, setPromotedFiles] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [insertNotice, setInsertNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refCounts = useMemo(
    () => countImageRefsInSeries(series),
    [series],
  );

  const usedRows = useMemo(
    () => buildUsedImageRows(promotedFiles, refCounts),
    [promotedFiles, refCounts],
  );

  const refreshLists = useCallback(async () => {
    setLoading(true);
    try {
      const [stagingRes, usedRes] = await Promise.all([
        fetch("/api/images/list?scope=staging&source=uploaded"),
        fetch("/api/images/list?scope=used"),
      ]);
      const stagingJson: { files?: ImageAsset[] } = await stagingRes.json();
      const usedJson: { files?: ImageAsset[] } = await usedRes.json();
      if (stagingRes.ok) setStagingFiles(stagingJson.files ?? []);
      if (usedRes.ok) setPromotedFiles(usedJson.files ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pane4Open) {
      void refreshLists();
    }
  }, [pane4Open, refreshLists, series]);

  const tryInsert = useCallback(
    (markdown: string) => {
      const ok = onInsertImage(markdown);
      if (!ok) {
        setInsertNotice("編集モードに切り替えてから挿入してください");
      } else {
        setInsertNotice(null);
      }
      return ok;
    },
    [onInsertImage],
  );

  const handleInsertStaging = useCallback(
    async (item: ImageGridItem) => {
      const res = await fetch("/api/images/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagingPath: item.path }),
      });
      const data: { file?: ImageAsset; error?: string } = await res.json();
      if (!res.ok || !data.file) {
        setInsertNotice(data.error ?? "画像の promote に失敗しました");
        return;
      }
      if (tryInsert(toImageMarkdown(data.file.path))) {
        await refreshLists();
      }
    },
    [tryInsert, refreshLists],
  );

  const handleInsertPromoted = useCallback(
    (item: ImageGridItem) => {
      tryInsert(toImageMarkdown(item.path));
    },
    [tryInsert],
  );

  const executeDelete = useCallback(
    async (item: PendingDelete, force = false) => {
      const params = new URLSearchParams({ path: item.path });
      if (force && item.referenceCount) {
        params.set("force", "1");
        params.set("referenceCount", String(item.referenceCount));
      }
      const res = await fetch(`/api/images/file?${params}`, { method: "DELETE" });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setInsertNotice(data.error ?? "削除に失敗しました");
        return;
      }
      await refreshLists();
    },
    [refreshLists],
  );

  const handleDeleteRequest = useCallback(
    (item: ImageGridItem, referenceCount = 0) => {
      if (item.missing) return;
      if (referenceCount > 0) {
        setPendingDelete({ ...item, referenceCount });
        return;
      }
      void executeDelete({ ...item, referenceCount });
    },
    [executeDelete],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const form = new FormData();
        form.append("file", file);
        form.append("source", "uploaded");
        await fetch("/api/images/upload", { method: "POST", body: form });
      }
      await refreshLists();
      setActiveTab("upload");
    },
    [refreshLists],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      void uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imageFiles: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) void uploadFiles(imageFiles);
    },
    [uploadFiles],
  );

  const stagingGridItems: ImageGridItem[] = stagingFiles.map((file) => ({
    path: file.path,
    name: file.name,
    showInsert: true,
    showDelete: true,
  }));

  const usedGridItems: ImageGridItem[] = usedRows.map((row) => ({
    path: row.path,
    name: row.name,
    missing: row.missing,
    statusLabel: row.missing
      ? "画像が存在しません"
      : row.referenceCount > 0
        ? `参照: ${row.referenceCount}`
        : "未使用",
    showInsert: !row.missing,
    showDelete: !row.missing,
  }));

  if (!pane4Open) {
    return (
      <div className="flex w-12 flex-shrink-0 flex-col items-center border-l border-border bg-card py-3">
        <Pane4Toggle open={false} onToggle={onTogglePane4} />
      </div>
    );
  }

  return (
    <PaneWheelRoot
      scrollRef={tabScrollRef}
      className="bg-card"
      onPaste={handlePaste}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-2 py-0">
        <div className="flex h-full min-w-0 items-center">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex h-full items-center gap-1 px-2 text-[10px] font-medium transition-colors",
                activeTab === tab.value
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <Pane4Toggle open={true} onToggle={onTogglePane4} />
      </div>

      {insertNotice ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-800 dark:text-amber-200">
          {insertNotice}
        </div>
      ) : null}

      {pane3Mode !== "raw" && activeTab !== "ai" && activeTab !== "web" ? (
        <div className="border-b border-border bg-muted/40 px-3 py-1 text-[10px] text-muted-foreground">
          画像の挿入は編集モードでのみ利用できます
        </div>
      ) : null}

      <div
        ref={tabScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        {loading && activeTab !== "ai" && activeTab !== "web" ? (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            読み込み中...
          </div>
        ) : null}

        {activeTab === "used" && !loading ? (
          <ImageGrid
            items={usedGridItems}
            emptyMessage="promote 済みの画像がありません"
            onPreview={(item) =>
              setPreview({
                name: item.name,
                path: item.path,
                statusLabel: item.statusLabel,
              })
            }
            onInsert={handleInsertPromoted}
            onDelete={(item) => {
              const row = usedRows.find((r) => r.path === item.path);
              handleDeleteRequest(item, row?.referenceCount ?? 0);
            }}
          />
        ) : null}

        {activeTab === "upload" && !loading ? (
          <>
            <div className="p-3">
              <div
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary hover:bg-primary/5",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">
                  ドラッグ&ドロップ
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  またはクリックして選択
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) =>
                  e.target.files && void uploadFiles(e.target.files)
                }
              />
            </div>
            <ImageGrid
              items={stagingGridItems}
              emptyMessage="staging に画像がありません"
              onPreview={(item) =>
                setPreview({ name: item.name, path: item.path })
              }
              onInsert={handleInsertStaging}
              onDelete={(item) => void executeDelete({ ...item, referenceCount: 0 })}
            />
          </>
        ) : null}

        {activeTab === "ai" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs font-medium text-muted-foreground">AI画像生成</p>
            <p className="text-[10px] text-muted-foreground/70">準備中です</p>
          </div>
        ) : null}

        {activeTab === "web" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs font-medium text-muted-foreground">Web画像検索</p>
            <p className="text-[10px] text-muted-foreground/70">準備中です</p>
          </div>
        ) : null}
      </div>

      {preview ? (
        <ImageLightbox
          open={!!preview}
          onOpenChange={(open) => !open && setPreview(null)}
          name={preview.name}
          path={preview.path}
          statusLabel={preview.statusLabel}
        />
      ) : null}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>画像を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name} は {pendingDelete?.referenceCount} 箇所で参照されています。
              ファイルを削除すると Markdown 上のリンクが壊れます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  void executeDelete(pendingDelete, true);
                  setPendingDelete(null);
                }
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PaneWheelRoot>
  );
}
