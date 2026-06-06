"use client";

import { useEffect } from "react";
import { Loader2, Pen, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageGrid, type ImageGridItem } from "@/components/workspace/ImageGrid";
import { Button } from "@/components/ui/button";
import {
  PANE4_BUTTON_ROW_CLASS,
  PANE4_PROMPT_BLOCK_CLASS,
  PANE4_PROMPT_TEXTAREA_CLASS,
  PANE4_TAB_INSET,
} from "@/components/workspace/image-manager/image-manager-constants";
import { TabNoticeBanner } from "@/components/workspace/image-manager/TabNoticeBanner";
import type { TabNotice } from "@/components/workspace/image-manager/types";
import { useWebImageTab } from "@/components/workspace/image-manager/use-web-image-tab";
import type { Lesson } from "@/lib/schema";

type Props = {
  lesson: Lesson | undefined;
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  refreshScope: (
    scope: "web",
    options?: { silent?: boolean },
  ) => Promise<void>;
  showNotice: (tab: "web", message: string, tone: "error" | "success") => void;
  clearNotice: (tab: "web") => void;
  gridItems: ImageGridItem[];
  notice?: TabNotice;
  onResolveAltReady: (
    resolveAlt: ((item: ImageGridItem) => string | undefined) | null,
  ) => void;
  onPreview: (item: ImageGridItem) => void;
  onInsert: (item: ImageGridItem) => void;
  onDelete: (item: ImageGridItem) => void;
};

export function WebImagesTab({
  lesson,
  editorCommentPrompt,
  editorCursorOffset,
  refreshScope,
  showNotice,
  clearNotice,
  gridItems,
  notice,
  onResolveAltReady,
  onPreview,
  onInsert,
  onDelete,
}: Props) {
  const {
    prompt,
    setPrompt,
    searching,
    suggesting,
    resolveAlt,
    handleSearch,
    handleAutoFill,
    handleResetPrompt,
  } = useWebImageTab({
    lesson,
    editorCommentPrompt,
    editorCursorOffset,
    refreshScope,
    showNotice,
    clearNotice,
  });

  useEffect(() => {
    onResolveAltReady(resolveAlt);
    return () => onResolveAltReady(null);
  }, [resolveAlt, onResolveAltReady]);

  return (
    <>
      <TabNoticeBanner notice={notice} />
      <div className={cn(PANE4_TAB_INSET, "flex flex-col gap-3 pb-3 pt-3")}>
        {!lesson ? (
          <p className="text-center text-xs text-muted-foreground">
            レッスンを選択してください
          </p>
        ) : (
          <>
            <div className={PANE4_PROMPT_BLOCK_CLASS}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="画像検索条件を入力してください"
                className={PANE4_PROMPT_TEXTAREA_CLASS}
              />
              <div className={PANE4_BUTTON_ROW_CLASS}>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 px-4 text-xs transition-colors enabled:hover:bg-primary/85"
                  disabled={searching || suggesting || !prompt.trim()}
                  onClick={() => void handleSearch()}
                >
                  {searching ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      検索中...
                    </>
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5" />
                      検索
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  disabled={!lesson || suggesting || searching}
                  onClick={() => void handleAutoFill()}
                >
                  {suggesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Pen className="h-3.5 w-3.5" />
                  )}
                  自動入力
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  disabled={suggesting || searching}
                  onClick={handleResetPrompt}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  リセット
                </Button>
              </div>
            </div>
            <ImageGrid
              items={gridItems}
              emptyMessage="Web staging に画像がありません"
              onPreview={onPreview}
              onInsert={onInsert}
              onDelete={onDelete}
            />
          </>
        )}
      </div>
    </>
  );
}
