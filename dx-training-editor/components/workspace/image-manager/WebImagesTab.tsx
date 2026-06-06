"use client";

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

type Props = {
  hasLesson: boolean;
  prompt: string;
  onPromptChange: (value: string) => void;
  searching: boolean;
  suggesting: boolean;
  gridItems: ImageGridItem[];
  notice?: TabNotice;
  onSearch: () => void;
  onAutoFill: () => void;
  onResetPrompt: () => void;
  onPreview: (item: ImageGridItem) => void;
  onInsert: (item: ImageGridItem) => void;
  onDelete: (item: ImageGridItem) => void;
};

export function WebImagesTab({
  hasLesson,
  prompt,
  onPromptChange,
  searching,
  suggesting,
  gridItems,
  notice,
  onSearch,
  onAutoFill,
  onResetPrompt,
  onPreview,
  onInsert,
  onDelete,
}: Props) {
  return (
    <>
      <TabNoticeBanner notice={notice} />
      <div className={cn(PANE4_TAB_INSET, "flex flex-col gap-3 pb-3 pt-3")}>
        {!hasLesson ? (
          <p className="text-center text-xs text-muted-foreground">
            レッスンを選択してください
          </p>
        ) : (
          <>
            <div className={PANE4_PROMPT_BLOCK_CLASS}>
              <textarea
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
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
                  onClick={onSearch}
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
                  disabled={!hasLesson || suggesting || searching}
                  onClick={onAutoFill}
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
                  onClick={onResetPrompt}
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
