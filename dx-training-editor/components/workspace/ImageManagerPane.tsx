"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  Clock,
  Sparkles,
  Search,
  ChevronRight,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import type { ImageAsset } from "@/lib/schema";

type Props = {
  imageHistory: ImageAsset[];
  onAddImage: (asset: ImageAsset) => void;
  onInsertImage: (markdown: string) => void;
  pane4Open: boolean;
  onTogglePane4: () => void;
};

type Tab = "upload" | "history" | "ai" | "web";

const TABS: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
  { value: "upload", label: "UP", icon: <Upload className="h-3 w-3" /> },
  { value: "history", label: "履歴", icon: <Clock className="h-3 w-3" /> },
  { value: "ai", label: "AI", icon: <Sparkles className="h-3 w-3" /> },
  { value: "web", label: "Web", icon: <Search className="h-3 w-3" /> },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageManagerPane({
  imageHistory,
  onAddImage,
  onInsertImage,
  pane4Open,
  onTogglePane4,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [isDragOver, setIsDragOver] = useState(false);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await readFileAsDataUrl(file);
        const asset: ImageAsset = {
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          dataUrl,
          uploadedAt: new Date().toISOString(),
        };
        onAddImage(asset);
      }
      setActiveTab("history");
    },
    [onAddImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) handleFiles(imageFiles);
    },
    [handleFiles],
  );

  const handleInsertImage = (asset: ImageAsset) => {
    const markdown = `![${asset.name}](${asset.dataUrl})`;
    onInsertImage(markdown);
  };

  // 折りたたみ状態
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
      {/* ヘッダー */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-2 py-0">
        <div className="flex h-full min-w-0 items-center">
          {TABS.map((tab) => (
            <button
              key={tab.value}
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

      {/* タブコンテンツ */}
      <div
        ref={tabScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        {/* アップロードタブ */}
        {activeTab === "upload" && (
          <div className="p-3">
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
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
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
        )}

        {/* 履歴タブ */}
        {activeTab === "history" && (
          <div className="p-2">
            {imageHistory.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                まだ画像がありません
              </div>
            ) : (
              <div className="space-y-1">
                <p className="px-1 text-[10px] text-muted-foreground">
                  クリックするとエディタに挿入
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {imageHistory.map((asset) => (
                    <WorkspaceTooltip
                      key={asset.id}
                      label={asset.name}
                      render={
                        <button
                          type="button"
                          onClick={() => handleInsertImage(asset)}
                          className="group relative aspect-square w-full overflow-hidden rounded border border-border bg-muted hover:border-primary transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.dataUrl}
                            alt={asset.name}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-end bg-black/0 p-1 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
                            <span className="truncate text-[9px] text-white">
                              {asset.name}
                            </span>
                          </div>
                        </button>
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI生成タブ（モック） */}
        {activeTab === "ai" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs font-medium text-muted-foreground">
              AI画像生成
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              準備中です
            </p>
          </div>
        )}

        {/* Web検索タブ（モック） */}
        {activeTab === "web" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs font-medium text-muted-foreground">
              Web画像検索
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              準備中です
            </p>
          </div>
        )}
      </div>
    </PaneWheelRoot>
  );
}
