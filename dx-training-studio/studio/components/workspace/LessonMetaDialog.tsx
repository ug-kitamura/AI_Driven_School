"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { META_DIALOG_FORM } from "@/components/workspace/metaDialogLayout";
import {
  LessonMetaPanel,
  draftToMetaPatch,
  lessonToMetaDraft,
  type LessonMetaDraft,
} from "@/components/workspace/LessonMetaPanel";
import type { LessonMetaFields } from "@/lib/lesson-meta";
import type { Lesson } from "@/lib/schema";
import { EnMetaSection } from "@/components/workspace/translation/EnMetaSection";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson | undefined;
  onSave: (lessonId: string, meta: Partial<LessonMetaFields>) => void;
  tagSuggestions?: readonly string[];
  /**
   * レッスンの編集言語（ペイン2 ヘッダーの切替に連動）。
   * en では英語フィールドの編集になる（studio-translation spec）
   */
  language?: "ja" | "en";
  /** 英語ビューでの保存・翻訳適用の後に呼ぶ（鮮度チップの再取得） */
  onTranslationChanged?: () => void;
};

export function LessonMetaDialog({
  open,
  onOpenChange,
  lesson,
  onSave,
  tagSuggestions = [],
  language = "ja",
  onTranslationChanged,
}: Props) {
  const [draft, setDraft] = useState<LessonMetaDraft | null>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const flushTagsRef = useRef<(() => string[]) | null>(null);

  useEffect(() => {
    if (!open || !lesson) return;
    setDraft(lessonToMetaDraft(lesson));
    setTagError(null);
    setSlugError(null);
  }, [open, lesson]);

  const handleSave = () => {
    if (!lesson || !draft) return;
    const tags = flushTagsRef.current?.() ?? draft.tags;
    const {
      patch,
      tagError: err,
      slugError: slugErr,
    } = draftToMetaPatch({ ...draft, tags }, lesson);
    if (err || slugErr) {
      setTagError(err);
      setSlugError(slugErr);
      return;
    }
    onSave(lesson.id, patch);
    onOpenChange(false);
  };

  if (!lesson || !draft) return null;

  if (language === "en") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>レッスンメタ（英語）を編集</DialogTitle>
          </DialogHeader>
          <EnMetaSection
            level="lesson"
            names={{
              series: lesson.series,
              course: lesson.course,
              lesson: lesson.lesson,
            }}
            authorEnEditable
            onSaveAuthorEn={(authorEn) =>
              onSave(lesson.id, { author_en: authorEn })
            }
            onTranslationChanged={onTranslationChanged}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>レッスンメタを編集</DialogTitle>
        </DialogHeader>
        <LessonMetaPanel
          draft={draft}
          onDraftChange={(next) => {
            setDraft(next);
            if (tagError) setTagError(null);
            if (slugError) setSlugError(null);
          }}
          tagError={tagError}
          slugError={slugError}
          tagSuggestions={tagSuggestions}
          onFlushTagsReady={(flush) => {
            flushTagsRef.current = flush;
          }}
          className={META_DIALOG_FORM}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
