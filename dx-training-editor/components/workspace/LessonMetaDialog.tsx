"use client";

import { useEffect, useState } from "react";
import {
  CircleCheck,
  CircleDashed,
  Loader,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeTags, type LessonMetaFields } from "@/lib/lesson-frontmatter";
import { STATUS_LABELS, type Lesson, type LessonStatus } from "@/lib/schema";

const STATUS_ICONS: Record<LessonStatus, React.ReactNode> = {
  open: <CircleDashed className="h-4 w-4 text-[--status-draft]" />,
  in_progress: <Loader className="h-4 w-4 text-[--status-wip]" />,
  done: <CircleCheck className="h-4 w-4 text-[--status-done]" />,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson | undefined;
  seriesName: string;
  courseName: string;
  onSave: (lessonId: string, meta: Partial<LessonMetaFields>) => void;
};

export function LessonMetaDialog({
  open,
  onOpenChange,
  lesson,
  seriesName,
  courseName,
  onSave,
}: Props) {
  const [lessonTitle, setLessonTitle] = useState("");
  const [status, setStatus] = useState<LessonStatus>("open");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("0");
  const [author, setAuthor] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  useEffect(() => {
    if (!lesson || !open) return;
    setLessonTitle(lesson.lesson);
    setStatus(lesson.status);
    setDescription(lesson.description);
    setTagsInput(lesson.tags.join(", "));
    setEstimatedMinutes(String(lesson.estimated_minutes));
    setAuthor(lesson.author);
    setTagError(null);
  }, [lesson, open]);

  const handleSave = () => {
    if (!lesson) return;
    const rawTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const invalid = rawTags.filter((t) => !/^[a-z0-9-]+$/.test(t));
    if (invalid.length > 0) {
      setTagError(
        `タグは小文字英字・数字・ハイフンのみ: ${invalid.join(", ")}`,
      );
      return;
    }
    const minutes = Number.parseInt(estimatedMinutes, 10);
    onSave(lesson.id, {
      lesson: lessonTitle.trim() || lesson.lesson,
      status,
      description,
      tags: normalizeTags(rawTags),
      estimated_minutes: Number.isNaN(minutes) ? 0 : minutes,
      author,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>レッスンメタを編集</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>シリーズ</Label>
            <Input value={seriesName} readOnly className="bg-muted" />
          </div>
          <div className="grid gap-2">
            <Label>コース</Label>
            <Input value={courseName} readOnly className="bg-muted" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lesson-title">レッスン</Label>
            <Input
              id="lesson-title"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>ステータス</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                if (v) setStatus(v as LessonStatus);
              }}
            >
              <SelectTrigger>
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
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lesson-desc">説明</Label>
            <Input
              id="lesson-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lesson-tags">タグ（カンマ区切り）</Label>
            <Input
              id="lesson-tags"
              value={tagsInput}
              onChange={(e) => {
                setTagsInput(e.target.value);
                setTagError(null);
              }}
              placeholder="git, version-control"
            />
            {tagError ? (
              <p className="text-xs text-destructive">{tagError}</p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lesson-minutes">推定所要時間（分）</Label>
            <Select
              value={estimatedMinutes}
              onValueChange={(v) => {
                if (v) setEstimatedMinutes(v);
              }}
            >
              <SelectTrigger id="lesson-minutes">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {Array.from({ length: 181 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {i} 分
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lesson-author">著者</Label>
            <Input
              id="lesson-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
        </div>
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
