"use client";

import {
  CircleCheck,
  CircleDashed,
  Loader,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_GRID,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import { normalizeTags, type LessonMetaFields } from "@/lib/lesson-frontmatter";
import { STATUS_LABELS, type Lesson, type LessonStatus } from "@/lib/schema";

const STATUS_ICONS: Record<LessonStatus, React.ReactNode> = {
  open: <CircleDashed className="h-3.5 w-3.5 text-[--status-draft]" />,
  in_progress: <Loader className="h-3.5 w-3.5 text-[--status-wip]" />,
  done: <CircleCheck className="h-3.5 w-3.5 text-[--status-done]" />,
};

/** 未設定 */
const ESTIMATED_MINUTES_UNSET = "-";

const ESTIMATED_MINUTE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ESTIMATED_MINUTES_UNSET, label: ESTIMATED_MINUTES_UNSET },
  ...Array.from({ length: 12 }, (_, i) => {
    const minutes = (i + 1) * 5;
    return { value: String(minutes), label: `${minutes} min` };
  }),
];

const STATUS_SELECT_ITEMS = (["open", "in_progress", "done"] as const).map(
  (s) => ({
    value: s,
    label: (
      <span className="flex items-center gap-2">
        {STATUS_ICONS[s]}
        {STATUS_LABELS[s]}
      </span>
    ),
  }),
);

function minutesToSelectValue(minutes: number): string {
  if (minutes === 0) return ESTIMATED_MINUTES_UNSET;
  if (minutes >= 5 && minutes <= 60 && minutes % 5 === 0) {
    return String(minutes);
  }
  if (minutes < 5) return ESTIMATED_MINUTES_UNSET;
  const snapped = Math.min(60, Math.round(minutes / 5) * 5);
  return snapped === 0 ? ESTIMATED_MINUTES_UNSET : String(snapped);
}

export type LessonMetaDraft = {
  lesson: string;
  status: LessonStatus;
  description: string;
  tagsInput: string;
  estimatedMinutes: string;
  author: string;
};

export function lessonToMetaDraft(lesson: Lesson): LessonMetaDraft {
  return {
    lesson: lesson.lesson,
    status: lesson.status,
    description: lesson.description,
    tagsInput: lesson.tags.join(", "),
    estimatedMinutes: minutesToSelectValue(lesson.estimated_minutes),
    author: lesson.author,
  };
}

export function draftToMetaPatch(
  draft: LessonMetaDraft,
  fallbackLesson: Lesson,
): { patch: Partial<LessonMetaFields>; tagError: string | null } {
  const rawTags = draft.tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const invalid = rawTags.filter((t) => !/^[a-z0-9-]+$/.test(t));
  if (invalid.length > 0) {
    return {
      patch: {},
      tagError: `タグは小文字英字・数字・ハイフンのみ: ${invalid.join(", ")}`,
    };
  }
  const estimated_minutes =
    draft.estimatedMinutes === ESTIMATED_MINUTES_UNSET
      ? 0
      : Number.parseInt(draft.estimatedMinutes, 10) || 0;
  return {
    patch: {
      lesson: draft.lesson.trim() || fallbackLesson.lesson,
      status: draft.status,
      description: draft.description,
      tags: normalizeTags(rawTags),
      estimated_minutes,
      author: draft.author,
    },
    tagError: null,
  };
}

type Props = {
  draft: LessonMetaDraft;
  onDraftChange: (draft: LessonMetaDraft) => void;
  className?: string;
  tagError?: string | null;
};

export function LessonMetaPanel({
  className,
  draft,
  onDraftChange,
  tagError,
}: Props) {
  const patchDraft = (partial: Partial<LessonMetaDraft>) => {
    onDraftChange({ ...draft, ...partial });
  };

  return (
    <div className={cn(META_DIALOG_GRID, className)}>
      <MetaDialogField className="col-span-2">
        <Label htmlFor="lesson-meta-name">レッスン名</Label>
        <Input
          id="lesson-meta-name"
          value={draft.lesson}
          onChange={(e) => patchDraft({ lesson: e.target.value })}
          className={META_DIALOG_CONTROL}
        />
      </MetaDialogField>

      <MetaDialogField className="col-span-2">
        <Label htmlFor="lesson-meta-description">講義内容</Label>
        <Input
          id="lesson-meta-description"
          value={draft.description}
          onChange={(e) => patchDraft({ description: e.target.value })}
          className={META_DIALOG_CONTROL}
        />
      </MetaDialogField>

      <MetaDialogField>
        <Label htmlFor="lesson-meta-tags">タグ</Label>
        <Input
          id="lesson-meta-tags"
          value={draft.tagsInput}
          onChange={(e) => patchDraft({ tagsInput: e.target.value })}
          className={META_DIALOG_CONTROL}
          placeholder="カンマ区切り"
        />
      </MetaDialogField>

      <MetaDialogField>
        <Label htmlFor="lesson-meta-author">著者</Label>
        <Input
          id="lesson-meta-author"
          value={draft.author}
          onChange={(e) => patchDraft({ author: e.target.value })}
          className={META_DIALOG_CONTROL}
        />
      </MetaDialogField>

      <MetaDialogField>
        <Label htmlFor="lesson-meta-minutes">所要時間</Label>
        <Select
          items={ESTIMATED_MINUTE_OPTIONS}
          value={draft.estimatedMinutes}
          onValueChange={(v) => {
            if (!v) return;
            patchDraft({ estimatedMinutes: v });
          }}
        >
          <SelectTrigger
            id="lesson-meta-minutes"
            className={cn(META_DIALOG_CONTROL, "w-full")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTIMATED_MINUTE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </MetaDialogField>

      <MetaDialogField>
        <Label htmlFor="lesson-meta-status">進捗</Label>
        <Select
          items={STATUS_SELECT_ITEMS}
          value={draft.status}
          onValueChange={(v) => {
            if (!v) return;
            patchDraft({ status: v as LessonStatus });
          }}
        >
          <SelectTrigger
            id="lesson-meta-status"
            className={cn(META_DIALOG_CONTROL, "w-full")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["open", "in_progress", "done"] as const).map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  {STATUS_ICONS[s]}
                  {STATUS_LABELS[s]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </MetaDialogField>

      {tagError ? (
        <p className="col-span-2 text-xs text-destructive">{tagError}</p>
      ) : null}
    </div>
  );
}
