"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Edit3,
  CircleCheck,
  Loader,
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ADD_LIST_BUTTON_CLASS } from "@/components/workspace/constants";
import { cn, computeStatus } from "@/lib/utils";
import type { Series, Course, Lesson } from "@/lib/schema";
import {
  buildMiniMandalaGraphInput,
  filterCrossSeriesIds,
  getIntraSeriesNeighbors,
  formatCrossSeriesCourseLabel,
  listCrossSeriesCourseCandidates,
  type MiniMandalaGraphInput,
} from "@/lib/course-flow";

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
    icon: <CircleCheck className="h-3.5 w-3.5 text-[--status-done]" />,
    label: "完成",
  },
  in_progress: {
    icon: <Loader className="h-3.5 w-3.5 text-[--status-wip]" />,
    label: "作成中",
  },
  draft: {
    icon: <CircleDashed className="h-3.5 w-3.5 text-[--status-draft]" />,
    label: "未着手",
  },
};

const STATUS_CYCLE: Record<Lesson["status"], Lesson["status"]> = {
  draft: "in_progress",
  in_progress: "done",
  done: "draft",
};

const miniSafeId = (id: string) => `M_${id.replace(/[^a-zA-Z0-9]/g, "_")}`;

function addMiniNode(
  lines: string[],
  nodeMap: Record<string, string>,
  ref: { id: string; name: string },
) {
  const safeLabel = (s: string) => s.replace(/"/g, "'");
  const nid = miniSafeId(ref.id);
  nodeMap[nid] = ref.id;
  lines.push(`  ${nid}("${safeLabel(ref.name)}")`);
  lines.push(`  click ${nid} call miniGraphNav()`);
  return nid;
}

function buildMermaidDef(
  input: MiniMandalaGraphInput,
): { def: string; nodeMap: Record<string, string> } {
  const lines = ["flowchart LR"];
  const safeLabel = (s: string) => s.replace(/"/g, "'");
  const currentId = "CURRENT";
  const nodeMap: Record<string, string> = {};
  lines.push(`  ${currentId}("★ ${safeLabel(input.current.name)}")`);
  lines.push(`  style ${currentId} stroke-width:3px,font-weight:bold`);

  if (input.intraPrev) {
    const nid = addMiniNode(lines, nodeMap, input.intraPrev);
    lines.push(`  ${nid} --> ${currentId}`);
  }
  input.crossPrereqs.forEach((ref) => {
    const nid = addMiniNode(lines, nodeMap, ref);
    lines.push(`  ${nid} --> ${currentId}`);
  });
  if (input.intraNext) {
    const nid = addMiniNode(lines, nodeMap, input.intraNext);
    lines.push(`  ${currentId} --> ${nid}`);
  }
  input.crossNexts.forEach((ref) => {
    const nid = addMiniNode(lines, nodeMap, ref);
    lines.push(`  ${currentId} --> ${nid}`);
  });

  return { def: lines.join("\n"), nodeMap };
}

function CrossSeriesCoursePicker({
  candidates,
  selectedIds,
  onChange,
}: {
  candidates: Array<{ id: string; name: string; seriesName: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  if (candidates.length === 0) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground">
        選択できる別シリーズのコースがありません
      </p>
    );
  }

  return (
    <ScrollArea className="mt-1 h-40 max-h-[min(10rem,35vh)] rounded-md border border-border bg-white">
      <div className="space-y-0.5 p-2">
        {candidates.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-muted/60"
          >
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={selectedIds.includes(c.id)}
              onChange={() => toggle(c.id)}
            />
            <span className="leading-snug">
              {formatCrossSeriesCourseLabel(c.seriesName, c.name)}
            </span>
          </label>
        ))}
      </div>
    </ScrollArea>
  );
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
          isSelected
            ? "bg-accent text-primary"
            : "hover:bg-muted text-foreground",
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
            setDeleteConfirmOpen(true);
          }}
          className="flex-shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* ステータスアイコン（クリックで循環切り替え） */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(STATUS_CYCLE[lesson.status]);
          }}
          title={`${STATUS_ICON[lesson.status].label} → クリックで変更`}
          className="ml-1 flex-shrink-0 transition-opacity hover:opacity-70"
        >
          {STATUS_ICON[lesson.status].icon}
        </button>
      </div>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>レッスンを削除しますか？</DialogTitle>
            <DialogDescription>
              「{lesson.lesson}」を削除します。この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete();
                setDeleteConfirmOpen(false);
              }}
            >
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
    crossPrerequisites: string[];
    crossNextCourses: string[];
  }>({ target_audience: "", crossPrerequisites: [], crossNextCourses: [] });

  const miniGraphInput = useMemo(
    () => (course ? buildMiniMandalaGraphInput(series, course) : null),
    [series, course],
  );

  const intraNeighbors = useMemo(
    () =>
      course
        ? getIntraSeriesNeighbors(series, course.id)
        : { prev: null, next: null },
    [series, course],
  );

  const crossSeriesCandidates = useMemo(
    () =>
      course ? listCrossSeriesCourseCandidates(series, course.id) : [],
    [series, course],
  );

  // --- Mermaid: サムネイル用（常に先行レンダリング）---
  const [thumbnailSvg, setThumbnailSvg] = useState<string>("");
  useEffect(() => {
    if (!course || !miniGraphInput) { setThumbnailSvg(""); return; }
    const { def } = buildMermaidDef(miniGraphInput);
    let cancelled = false;
    import("mermaid").then(async (m) => {
      if (cancelled) return;
      try {
        const mermaid = m.default;
        mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "loose" });
        const id = `mthumb${course.id.replace(/[^a-zA-Z0-9]/g, "")}${Date.now()}`;
        const { svg } = await mermaid.render(id, def);
        if (!cancelled) setThumbnailSvg(svg);
      } catch { if (!cancelled) setThumbnailSvg(""); }
    });
    return () => { cancelled = true; };
  }, [course, miniGraphInput]);

  // --- Mermaid: モーダル用（開いたときにレンダリング・GlobalHeader と同じパターン）---
  const [mermaidModalOpen, setMermaidModalOpen] = useState(false);
  const [modalSvg, setModalSvg] = useState<string>("");
  const modalSvgRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modalBndRef = useRef<((el: Element) => void) | null>(null);

  // グローバルコールバック登録（ミニグラフ専用）
  const stableSelectCourse = useCallback(onSelectCourse, [onSelectCourse]);
  useEffect(() => {
    (window as unknown as Record<string, unknown>)["miniGraphNav"] = (nodeId: string) => {
      const w = window as unknown as Record<string, unknown>;
      const map = w["miniGraphNodeMap"] as Record<string, string> | undefined;
      const courseId = map?.[nodeId] ?? nodeId.replace(/^M_/, "").replace(/_/g, "-");
      stableSelectCourse(courseId);
      setMermaidModalOpen(false);
    };
    return () => {
      const w = window as unknown as Record<string, unknown>;
      delete w["miniGraphNav"];
      delete w["miniGraphNodeMap"];
    };
  }, [stableSelectCourse]);

  // モーダルが開いたときだけレンダリング（GlobalHeader と同じ lazy パターン）
  useEffect(() => {
    if (!mermaidModalOpen || !course || !miniGraphInput) return;
    const { def, nodeMap } = buildMermaidDef(miniGraphInput);
    (window as unknown as Record<string, unknown>)["miniGraphNodeMap"] = nodeMap;
    let cancelled = false;
    import("mermaid").then(async (m) => {
      if (cancelled) return;
      try {
        const mermaid = m.default;
        mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "loose" });
        const id = `mmodal${course.id.replace(/[^a-zA-Z0-9]/g, "")}${Date.now()}`;
        const { svg, bindFunctions } = await mermaid.render(id, def);
        if (!cancelled) {
          modalBndRef.current = bindFunctions ?? null;
          setModalSvg(svg);
        }
      } catch { if (!cancelled) setModalSvg(""); }
    });
    return () => { cancelled = true; };
  }, [mermaidModalOpen, course, miniGraphInput]);

  // モーダルを閉じたら SVG リセット
  useEffect(() => {
    if (!mermaidModalOpen) setModalSvg("");
  }, [mermaidModalOpen]);

  // SVG が DOM に描画されたら bindFunctions を呼ぶ（GlobalHeader と同じ）
  useEffect(() => {
    if (modalSvg && modalSvgRef.current && modalBndRef.current) {
      modalBndRef.current(modalSvgRef.current);
    }
  }, [modalSvg]);

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
                crossPrerequisites: filterCrossSeriesIds(
                  series,
                  course.id,
                  course.prerequisites,
                ),
                crossNextCourses: filterCrossSeriesIds(
                  series,
                  course.id,
                  course.next_courses,
                ),
              });
              setMetaDialogOpen(true);
            }}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        </div>

        <div className="text-xs">
          <div className="flex gap-1">
            <span className="w-8 flex-shrink-0 text-muted-foreground">
              対象:
            </span>
            <span className="truncate text-foreground">
              {course.target_audience || "—"}
            </span>
          </div>
        </div>

        {/* Mermaid ミニグラフ（クリックで拡大） */}
        {thumbnailSvg && (
          <>
            <button
              className="mt-2 w-full overflow-hidden rounded border border-border bg-white p-1 transition-opacity hover:opacity-80 cursor-zoom-in"
              title="クリックで拡大表示"
              onClick={() => setMermaidModalOpen(true)}
              dangerouslySetInnerHTML={{ __html: thumbnailSvg }}
            />
            <Dialog open={mermaidModalOpen} onOpenChange={setMermaidModalOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>トレーニングフロー</DialogTitle>
                </DialogHeader>
                {modalSvg ? (
                  <div
                    ref={modalSvgRef}
                    className="overflow-auto rounded bg-white p-4"
                    dangerouslySetInnerHTML={{ __html: modalSvg }}
                    onClick={(e) => {
                      // composedPath で SVG/foreignObject 境界を越えて g 要素を探索
                      for (const el of e.nativeEvent.composedPath()) {
                        const svgG = el as Element;
                        if (svgG.tagName === "g" && (svgG as SVGGElement).id) {
                          const match = (svgG as SVGGElement).id.match(/-flowchart-(M_[^-]+)-/);
                          if (match) {
                            const nav = (window as unknown as Record<string, unknown>)["miniGraphNav"] as ((id: string) => void) | undefined;
                            nav?.(match[1]);
                            return;
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    グラフを生成中...
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  ★ = 現在選択中のコース　　ノードをクリックするとそのコースに移動します
                </p>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* コース進捗（レッスン行と同じ px-2 で左右を揃える） */}
      <div className="mb-2 px-2 pt-2">
        <div className="mb-0.5 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">コース進捗</span>
          <span className="font-medium text-primary">
            {doneCount}/{course.lessons.length}
          </span>
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* レッスン一覧 */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
        <DndContext
          id="lesson-list-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={course.lessons.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1">
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
          className={ADD_LIST_BUTTON_CLASS}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{course.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
            <div className="col-span-2">
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
                className="mt-1 bg-white"
              />
            </div>
            <div>
              <Label>前のコース（同シリーズ）</Label>
              <p className="mt-1 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm">
                {intraNeighbors.prev?.name ?? "なし"}
              </p>
            </div>
            <div>
              <Label>次のコース（同シリーズ）</Label>
              <p className="mt-1 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm">
                {intraNeighbors.next?.name ?? "なし"}
              </p>
            </div>
            <div className="min-w-0">
              <Label>前のコース（別シリーズ）</Label>
              <CrossSeriesCoursePicker
                candidates={crossSeriesCandidates}
                selectedIds={editMeta.crossPrerequisites}
                onChange={(ids) =>
                  setEditMeta((prev) => ({ ...prev, crossPrerequisites: ids }))
                }
              />
            </div>
            <div className="min-w-0">
              <Label>次のコース（別シリーズ）</Label>
              <CrossSeriesCoursePicker
                candidates={crossSeriesCandidates}
                selectedIds={editMeta.crossNextCourses}
                onChange={(ids) =>
                  setEditMeta((prev) => ({ ...prev, crossNextCourses: ids }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                onUpdateCourseMeta(course.id, {
                  target_audience: editMeta.target_audience || undefined,
                  prerequisites: editMeta.crossPrerequisites,
                  next_courses: editMeta.crossNextCourses,
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
