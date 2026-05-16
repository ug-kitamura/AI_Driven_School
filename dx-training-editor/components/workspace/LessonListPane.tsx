"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Edit3,
  CircleCheck,
  RefreshCw,
  CircleDashed,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, computeStatus } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/schema";
import type { Series, Course, Lesson } from "@/lib/schema";

type Props = {
  series: Series[];
  course: Course | undefined;
  selectedLessonId: string;
  onSelectLesson: (lessonId: string) => void;
  onSelectCourse: (courseId: string) => void;
  onAddLesson: (courseId: string, lessonName: string) => void;
  onDeleteLesson: (courseId: string, lessonId: string) => void;
  onReorderLessons: (courseId: string, from: number, to: number) => void;
  onUpdateCourseMeta: (
    courseId: string,
    meta: Pick<Course, "target_audience" | "prerequisites" | "next_courses">,
  ) => void;
  onUpdateLessonStatus: (lessonId: string, status: Lesson["status"]) => void;
};

const STATUS_ICON: Record<
  Lesson["status"],
  { icon: React.ReactNode; label: string }
> = {
  done: {
    icon: <CircleCheck className="h-4 w-4 text-[--status-done]" />,
    label: "完成",
  },
  in_progress: {
    icon: <RefreshCw className="h-4 w-4 text-[--status-wip]" />,
    label: "作成中",
  },
  draft: {
    icon: <CircleDashed className="h-4 w-4 text-[--status-draft]" />,
    label: "未着手",
  },
};

const STATUS_CYCLE: Record<Lesson["status"], Lesson["status"]> = {
  draft: "in_progress",
  in_progress: "done",
  done: "draft",
};

// コース名 ID からコース名を解決するヘルパー
function resolveCourseNames(
  series: Series[],
  courseIds: string[],
): Array<{ id: string; name: string }> {
  return courseIds.map((id) => {
    for (const s of series) {
      const c = s.courses.find((c) => c.id === id);
      if (c) return { id, name: c.name };
    }
    return { id, name: id };
  });
}

// Mermaid グラフ文字列生成
function buildMermaidDef(
  course: Course,
  prereqNames: Array<{ id: string; name: string }>,
  nextNames: Array<{ id: string; name: string }>,
): string {
  const lines = ["flowchart LR"];
  const safeLabel = (s: string) => s.replace(/"/g, "'");
  const currentId = "CURRENT";
  lines.push(`  ${currentId}["★ ${safeLabel(course.name)}"]`);
  prereqNames.forEach(({ id, name }) => {
    lines.push(`  ${id}["${safeLabel(name)}"]`);
    lines.push(`  ${id} --> ${currentId}`);
  });
  nextNames.forEach(({ id, name }) => {
    lines.push(`  ${id}["${safeLabel(name)}"]`);
    lines.push(`  ${currentId} --> ${id}`);
  });
  return lines.join("\n");
}

// ソータブル行
function SortableLessonRow({
  lesson,
  isSelected,
  onSelect,
  onDelete,
  onStatusChange,
  courseId,
}: {
  lesson: Lesson;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onStatusChange: (status: Lesson["status"]) => void;
  courseId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-accent text-foreground",
      )}
    >
      {/* ドラッグハンドル */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100"
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* ステータスアイコン（クリックで循環切り替え） */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onStatusChange(STATUS_CYCLE[lesson.status]);
        }}
        title={`${STATUS_ICON[lesson.status].label} → クリックで変更`}
        className="flex-shrink-0 transition-opacity hover:opacity-70"
      >
        {STATUS_ICON[lesson.status].icon}
      </button>

      {/* レッスン名 */}
      <button
        onClick={onSelect}
        className="flex-1 truncate text-left text-xs"
      >
        {lesson.lesson}
      </button>

      {/* 削除ボタン */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex-shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

export function LessonListPane({
  series,
  course,
  selectedLessonId,
  onSelectLesson,
  onSelectCourse,
  onAddLesson,
  onDeleteLesson,
  onReorderLessons,
  onUpdateCourseMeta,
  onUpdateLessonStatus,
}: Props) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newLessonName, setNewLessonName] = useState("");
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [editMeta, setEditMeta] = useState<{
    target_audience: string;
    prerequisites: string;
    next_courses: string;
  }>({ target_audience: "", prerequisites: "", next_courses: "" });

  // Mermaid レンダリング
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [mermaidSvg, setMermaidSvg] = useState<string>("");

  const prereqNames = useMemo(
    () => resolveCourseNames(series, course?.prerequisites ?? []),
    [series, course],
  );
  const nextNames = useMemo(
    () => resolveCourseNames(series, course?.next_courses ?? []),
    [series, course],
  );

  useEffect(() => {
    if (!course) {
      setMermaidSvg("");
      return;
    }
    const def = buildMermaidDef(course, prereqNames, nextNames);
    let cancelled = false;
    import("mermaid").then((m) => {
      if (cancelled) return;
      const mermaid = m.default;
      mermaid.initialize({ startOnLoad: false, theme: "base" });
      mermaid
        .render(`mermaid-${course.id}`, def)
        .then(({ svg }) => {
          if (!cancelled) setMermaidSvg(svg);
        })
        .catch(() => {
          if (!cancelled) setMermaidSvg("");
        });
    });
    return () => {
      cancelled = true;
    };
  }, [course, prereqNames, nextNames]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!course) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = course.lessons.findIndex((l) => l.id === active.id);
    const toIndex = course.lessons.findIndex((l) => l.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderLessons(course.id, fromIndex, toIndex);
    }
  };

  if (!course) {
    return (
      <div className="flex w-72 flex-shrink-0 items-center justify-center border-r border-border bg-card text-muted-foreground text-sm">
        コースを選択してください
      </div>
    );
  }

  const courseStatus = computeStatus(course.lessons.map((l) => l.status));
  const doneCount = course.lessons.filter((l) => l.status === "done").length;
  const progress =
    course.lessons.length > 0
      ? Math.round((doneCount / course.lessons.length) * 100)
      : 0;

  return (
    <div className="flex w-72 flex-shrink-0 flex-col border-r border-border bg-card">
      {/* コースメタ情報エリア */}
      <div className="border-b border-border bg-muted/40 px-3 py-2">
        <div className="mb-2 flex items-center gap-1">
          <span className="flex-1 truncate text-xs font-bold text-foreground">
            {course.name}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => {
              setEditMeta({
                target_audience: course.target_audience ?? "",
                prerequisites: course.prerequisites.join(", "),
                next_courses: course.next_courses.join(", "),
              });
              setMetaDialogOpen(true);
            }}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        </div>

        {/* メタ情報テーブル */}
        <div className="space-y-1 text-xs">
          <div className="flex gap-1">
            <span className="w-8 flex-shrink-0 text-muted-foreground">
              対象:
            </span>
            <span className="truncate text-foreground">
              {course.target_audience || "—"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 items-start">
            <span className="w-8 flex-shrink-0 text-muted-foreground">
              前回:
            </span>
            <div className="flex flex-wrap gap-1">
              {prereqNames.length > 0 ? (
                prereqNames.map(({ id, name }) => (
                  <button
                    key={id}
                    onClick={() => onSelectCourse(id)}
                    className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary hover:text-white transition-colors"
                  >
                    {name}
                  </button>
                ))
              ) : (
                <span className="text-muted-foreground">なし</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 items-start">
            <span className="w-8 flex-shrink-0 text-muted-foreground">
              次回:
            </span>
            <div className="flex flex-wrap gap-1">
              {nextNames.length > 0 ? (
                nextNames.map(({ id, name }) => (
                  <button
                    key={id}
                    onClick={() => onSelectCourse(id)}
                    className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary hover:text-white transition-colors"
                  >
                    {name}
                  </button>
                ))
              ) : (
                <span className="text-muted-foreground">なし</span>
              )}
            </div>
          </div>
        </div>

        {/* Mermaid ミニグラフ */}
        {mermaidSvg && (
          <div
            className="mt-2 overflow-hidden rounded border border-border bg-white p-1"
            dangerouslySetInnerHTML={{ __html: mermaidSvg }}
          />
        )}
      </div>

      {/* コース進捗バー */}
      <div className="border-b border-border px-3 py-2">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">コース進捗</span>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-primary">
              {doneCount}/{course.lessons.length}
            </span>
          </div>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* レッスン一覧 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={course.lessons.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-0.5">
              {course.lessons.map((lesson) => (
                <SortableLessonRow
                  key={lesson.id}
                  lesson={lesson}
                  isSelected={lesson.id === selectedLessonId}
                  onSelect={() => onSelectLesson(lesson.id)}
                  onDelete={() => onDeleteLesson(course.id, lesson.id)}
                  onStatusChange={(status) =>
                    onUpdateLessonStatus(lesson.id, status)
                  }
                  courseId={course.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* レッスン追加ボタン */}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start gap-1 border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary"
          onClick={() => {
            setNewLessonName("");
            setAddDialogOpen(true);
          }}
        >
          <Plus className="h-3 w-3" />
          レッスンを追加
        </Button>
      </div>

      {/* レッスン追加ダイアログ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>レッスンを追加</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="lesson-name">レッスン名</Label>
            <Input
              id="lesson-name"
              value={newLessonName}
              onChange={(e) => setNewLessonName(e.target.value)}
              placeholder="例: Gitのインストール手順"
              className="mt-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLessonName.trim()) {
                  onAddLesson(course.id, newLessonName.trim());
                  setAddDialogOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (newLessonName.trim()) {
                  onAddLesson(course.id, newLessonName.trim());
                  setAddDialogOpen(false);
                }
              }}
            >
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* コースメタ編集ダイアログ */}
      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>コースメタ情報を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>受講対象者</Label>
              <Input
                value={editMeta.target_audience}
                onChange={(e) =>
                  setEditMeta((prev) => ({
                    ...prev,
                    target_audience: e.target.value,
                  }))
                }
                placeholder="例: Git未経験の開発者"
                className="mt-1"
              />
            </div>
            <div>
              <Label>前提コース ID（カンマ区切り）</Label>
              <Input
                value={editMeta.prerequisites}
                onChange={(e) =>
                  setEditMeta((prev) => ({
                    ...prev,
                    prerequisites: e.target.value,
                  }))
                }
                placeholder="例: course-git-concept, course-git-env"
                className="mt-1"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                コースのIDを入力してください（data/content.json の id フィールド）
              </p>
            </div>
            <div>
              <Label>次のコース ID（カンマ区切り）</Label>
              <Input
                value={editMeta.next_courses}
                onChange={(e) =>
                  setEditMeta((prev) => ({
                    ...prev,
                    next_courses: e.target.value,
                  }))
                }
                placeholder="例: course-git-branch, course-github-intro"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                const parseIds = (s: string) =>
                  s
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                onUpdateCourseMeta(course.id, {
                  target_audience: editMeta.target_audience || undefined,
                  prerequisites: parseIds(editMeta.prerequisites),
                  next_courses: parseIds(editMeta.next_courses),
                });
                setMetaDialogOpen(false);
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
