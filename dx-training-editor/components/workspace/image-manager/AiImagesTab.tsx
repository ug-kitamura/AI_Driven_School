"use client";

import { Loader2, Pen, RotateCcw, Wand2 } from "lucide-react";
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
  generating: boolean;
  suggesting: boolean;
  gridItems: ImageGridItem[];
  notice?: TabNotice;
  onGenerate: () => void;
  onAutoFill: () => void;
  onResetPrompt: () => void;
  onPreview: (item: ImageGridItem) => void;
  onInsert: (item: ImageGridItem) => void;
  onDelete: (item: ImageGridItem) => void;
};

export function AiImagesTab({
  hasLesson,
  prompt,
  onPromptChange,
  generating,
  suggesting,
  gridItems,
  notice,
  onGenerate,
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
                placeholder="画像生成プロンプトを入力してください"
                className={PANE4_PROMPT_TEXTAREA_CLASS}
              />
              <div className={PANE4_BUTTON_ROW_CLASS}>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 px-4 text-xs transition-colors enabled:hover:bg-primary/85"
                  disabled={generating || suggesting || !prompt.trim()}
                  onClick={onGenerate}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" />
                      生成
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  disabled={!hasLesson || suggesting || generating}
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
                  disabled={suggesting || generating}
                  onClick={onResetPrompt}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  リセット
                </Button>
              </div>
            </div>
            <ImageGrid
              items={gridItems}
              emptyMessage="AI staging に画像がありません"
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
