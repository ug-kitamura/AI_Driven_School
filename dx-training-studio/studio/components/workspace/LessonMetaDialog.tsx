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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson | undefined;
  onSave: (lessonId: string, meta: Partial<LessonMetaFields>) => void;
  tagSuggestions?: readonly string[];
};

export function LessonMetaDialog({
  open,
  onOpenChange,
  lesson,
  onSave,
  tagSuggestions = [],
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
