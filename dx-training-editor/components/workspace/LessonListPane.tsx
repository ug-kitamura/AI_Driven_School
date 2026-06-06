"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  CircleCheck,
  Loader,
  CircleDashed,
  AlertTriangle,
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
import {
  META_DIALOG_CONTROL,
  META_DIALOG_FORM,
  META_DIALOG_GRID,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import { CrossSeriesCourseTreePicker } from "@/components/workspace/CrossSeriesCourseTreePicker";
import {
  ADD_LIST_BUTTON_CLASS,
  SORTABLE_POINTER_ACTIVATION,
} from "@/components/workspace/constants";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import { cn, computeStatus } from "@/lib/utils";
import {
  getMermaidWorkspaceConfig,
  mandalaCurrentCourseStyleLine,
  scaleMiniMandalaThumbnailSvg,
} from "@/lib/mermaid-workspace-theme";
import type { Series, Course, Lesson } from "@/lib/schema";
import {
  buildMiniMandalaGraphInput,
  filterCrossSeriesIds,
  getIntraSeriesNeighbors,
  listCrossSeriesCourseCandidates,
  wouldCourseMetaEditCreateCycle,
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
    meta: Pick<
      Course,
      "name" | "target_audience" | "prerequisites" | "next_courses"
    >,
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
  open: {
    icon: <CircleDashed className="h-3.5 w-3.5 text-[--status-draft]" />,
    label: "未着手",
  },
};

const STATUS_CYCLE: Record<Lesson["status"], Lesson["status"]> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
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
  const nodeMap: Record<string, string> = { [currentId]: input.current.id };
  lines.push(`  ${currentId}("★ ${safeLabel(input.current.name)}")`);
  lines.push(mandalaCurrentCourseStyleLine(currentId, 2));
  lines.push(`  click ${currentId} call miniGraphNav()`);

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
        onClick={onSelect}
        className={cn(
          "group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
          isSelected
            ? "bg-muted text-primary dark:bg-accent dark:text-primary"
            : "hover:bg-muted text-foreground",
        )}
      >
        <span className="size-3.5 shrink-0" aria-hidden />
        <span
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="flex-1 truncate text-left text-xs group-hover:cursor-grab active:cursor-grabbing"
        >
          {lesson.lesson}
        </span>

        {/* 削除ボタン */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteConfirmOpen(true);
          }}
          className="flex-shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* ステータスアイコン（クリックで循環切り替え） */}
        <WorkspaceTooltip
          label={STATUS_ICON[lesson.status].label}
          render={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(STATUS_CYCLE[lesson.status]);
              }}
              className="ml-1 flex-shrink-0 transition-opacity hover:opacity-70"
              aria-label={`${STATUS_ICON[lesson.status].label}、クリックで変更`}
            >
              {STATUS_ICON[lesson.status].icon}
            </button>
          }
        />
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
  const lessonScrollRef = useRef<HTMLDivElement>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newLessonName, setNewLessonName] = useState("");
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [metaCycleWarning, setMetaCycleWarning] = useState(false);
  const [editMeta, setEditMeta] = useState<{
    name: string;
    target_audience: string;
    crossPrerequisites: string[];
    crossNextCourses: string[];
  }>({
    name: "",
    target_audience: "",
    crossPrerequisites: [],
    crossNextCourses: [],
  });

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

  const [mermaidIsDark, setMermaidIsDark] = useState(false);
  useEffect(() => {
    const update = () =>
      setMermaidIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  // --- Mermaid: サムネイル用（常に先行レンダリング）---
  const [thumbnailSvg, setThumbnailSvg] = useState<string>("");
  const [thumbnailError, setThumbnailError] = useState(false);
  useEffect(() => {
    if (!course || !miniGraphInput) {
      setThumbnailSvg("");
      setThumbnailError(false);
      return;
    }
    const { def } = buildMermaidDef(miniGraphInput);
    let cancelled = false;
    setThumbnailError(false);
    import("mermaid").then(async (m) => {
      if (cancelled) return;
      try {
        const mermaid = m.default;
        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize(
          getMermaidWorkspaceConfig(isDark, { thumbnail: true }),
        );
        const id = `mthumb${course.id.replace(/[^a-zA-Z0-9]/g, "")}${Date.now()}`;
        const { svg } = await mermaid.render(id, def);
        if (!cancelled) {
          setThumbnailSvg(scaleMiniMandalaThumbnailSvg(svg));
          setThumbnailError(false);
        }
      } catch {
        if (!cancelled) {
          setThumbnailSvg("");
          setThumbnailError(true);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [course, miniGraphInput, mermaidIsDark]);

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
        mermaid.initialize(getMermaidWorkspaceConfig(mermaidIsDark));
        const id = `mmodal${course.id.replace(/[^a-zA-Z0-9]/g, "")}${Date.now()}`;
        const { svg, bindFunctions } = await mermaid.render(id, def);
        if (!cancelled) {
          modalBndRef.current = bindFunctions ?? null;
          setModalSvg(svg);
        }
      } catch { if (!cancelled) setModalSvg(""); }
    });
    return () => { cancelled = true; };
  }, [mermaidModalOpen, course, miniGraphInput, mermaidIsDark]);

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
    useSensor(PointerSensor, {
      activationConstraint: SORTABLE_POINTER_ACTIVATION,
    }),
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
      <div className="flex h-full w-full items-center justify-center bg-card text-muted-foreground text-sm">
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
    <PaneWheelRoot scrollRef={lessonScrollRef} className="min-w-0 bg-card">
      {/* コースメタ情報エリア */}
      <div className="min-w-0 shrink-0 border-b border-border bg-muted/40 px-3 py-2">
        <div className="mb-2 flex items-center gap-1">
          <span className="flex-1 truncate text-xs font-bold text-foreground">
            {course.name}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            aria-label="コースメタを編集"
            onClick={() => {
              setEditMeta({
                name: course.name,
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
              setMetaCycleWarning(false);
              setMetaDialogOpen(true);
            }}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        </div>

        <div className="text-xs">
          <div className="flex gap-1">
            <span className="truncate text-foreground text-muted-foreground">
              対象: {course.target_audience || "—"}
            </span>
          </div>
        </div>

        {/* Mermaid ミニグラフ（クリックで拡大） */}
        {miniGraphInput ? (
          <>
            {thumbnailSvg ? (
              <button
                type="button"
                className="mt-2 block w-full min-w-0 cursor-zoom-in overflow-hidden rounded border border-border bg-card p-1 text-left transition-opacity hover:opacity-80"
                onClick={() => setMermaidModalOpen(true)}
                aria-label="ミニ曼陀羅を拡大表示"
              >
                <div
                  className="mini-mandala-thumbnail w-full min-w-0"
                  dangerouslySetInnerHTML={{ __html: thumbnailSvg }}
                />
              </button>
            ) : (
              <button
                type="button"
                className="mt-2 flex min-h-[72px] w-full items-center justify-center rounded border border-border bg-card px-2 text-[10px] text-muted-foreground hover:bg-muted/30"
                onClick={() => setMermaidModalOpen(true)}
                aria-label="ミニ曼陀羅を拡大表示"
              >
                {thumbnailError ? "グラフを表示できません（クリックで拡大）" : "グラフを生成中..."}
              </button>
            )}
            <Dialog open={mermaidModalOpen} onOpenChange={setMermaidModalOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>ミニ曼陀羅</DialogTitle>
                </DialogHeader>
                {modalSvg ? (
                  <div className="flex justify-center overflow-auto rounded bg-card p-4">
                    <div
                      ref={modalSvgRef}
                      className="mini-mandala-graph w-fit"
                      dangerouslySetInnerHTML={{ __html: modalSvg }}
                    onClick={(e) => {
                      // composedPath で SVG/foreignObject 境界を越えて g 要素を探索
                      for (const el of e.nativeEvent.composedPath()) {
                        const svgG = el as Element;
                        if (svgG.tagName === "g" && (svgG as SVGGElement).id) {
                          const match = (svgG as SVGGElement).id.match(
                            /-flowchart-(M_[^-]+|CURRENT)-/,
                          );
                          if (match) {
                            const nav = (window as unknown as Record<string, unknown>)["miniGraphNav"] as ((id: string) => void) | undefined;
                            nav?.(match[1]);
                            return;
                          }
                        }
                      }
                    }}
                    />
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    グラフを生成中...
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground text-left pt-1">
                  ★ = 現在選択中のコース　　ノードをクリックするとそのコースに移動します
                </p>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </div>

      {/* コース進捗（レッスン行と同じ px-2 で左右を揃える） */}
      <div className="mb-2 shrink-0 px-2 pt-2">
        <div className="mb-0.5 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">コース進捗</span>
          <span className="font-medium text-primary">
            {doneCount}/{course.lessons.length}
          </span>
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* レッスン一覧 */}
      <div
        ref={lessonScrollRef}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain px-2 pb-2"
      >
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
          レッスンを追加
          <Plus className="h-3 w-3 shrink-0" />
        </Button>
      </div>

      {/* レッスン追加ダイアログ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>レッスンを追加</DialogTitle>
          </DialogHeader>
          <div className={META_DIALOG_FORM}>
            <MetaDialogField>
              <Label htmlFor="lesson-name">レッスン名</Label>
              <Input
                id="lesson-name"
                value={newLessonName}
                onChange={(e) => setNewLessonName(e.target.value)}
                placeholder="例: Gitのインストール手順"
                className={META_DIALOG_CONTROL}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newLessonName.trim()) {
                    onAddLesson(course.id, newLessonName.trim());
                    setAddDialogOpen(false);
                  }
                }}
              />
            </MetaDialogField>
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
      <Dialog
        open={metaDialogOpen}
        onOpenChange={(open) => {
          setMetaDialogOpen(open);
          if (!open) setMetaCycleWarning(false);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>コースメタを編集</DialogTitle>
          </DialogHeader>
          <div className={cn(META_DIALOG_GRID, META_DIALOG_FORM)}>
            <MetaDialogField className="col-span-2">
              <Label htmlFor="course-meta-name">コース名</Label>
              <Input
                id="course-meta-name"
                value={editMeta.name}
                onChange={(e) =>
                  setEditMeta((prev) => ({ ...prev, name: e.target.value }))
                }
                className={META_DIALOG_CONTROL}
              />
            </MetaDialogField>
            <MetaDialogField className="col-span-2">
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
                className={META_DIALOG_CONTROL}
              />
            </MetaDialogField>
            <MetaDialogField>
              <Label>前のコース（同シリーズ）</Label>
              <p className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm">
                {intraNeighbors.prev?.name ?? "なし"}
              </p>
            </MetaDialogField>
            <MetaDialogField>
              <Label>次のコース（同シリーズ）</Label>
              <p className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm">
                {intraNeighbors.next?.name ?? "なし"}
              </p>
            </MetaDialogField>
            <MetaDialogField className="min-w-0">
              <Label>前のコース（別シリーズ）</Label>
              <CrossSeriesCourseTreePicker
                candidates={crossSeriesCandidates}
                selectedIds={editMeta.crossPrerequisites}
                onChange={(ids) => {
                  setMetaCycleWarning(false);
                  setEditMeta((prev) => ({ ...prev, crossPrerequisites: ids }));
                }}
              />
            </MetaDialogField>
            <MetaDialogField className="min-w-0">
              <Label>次のコース（別シリーズ）</Label>
              <CrossSeriesCourseTreePicker
                candidates={crossSeriesCandidates}
                selectedIds={editMeta.crossNextCourses}
                onChange={(ids) => {
                  setMetaCycleWarning(false);
                  setEditMeta((prev) => ({ ...prev, crossNextCourses: ids }));
                }}
              />
            </MetaDialogField>
          </div>
          {metaCycleWarning && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                曼陀羅全体に循環する経路が生じます。別シリーズの前/次コースの設定を見直してください。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (!course) return;
                const crossPrerequisites = filterCrossSeriesIds(
                  series,
                  course.id,
                  editMeta.crossPrerequisites,
                );
                const crossNextCourses = filterCrossSeriesIds(
                  series,
                  course.id,
                  editMeta.crossNextCourses,
                );
                if (
                  wouldCourseMetaEditCreateCycle(
                    series,
                    course.id,
                    crossPrerequisites,
                    crossNextCourses,
                  )
                ) {
                  setMetaCycleWarning(true);
                  return;
                }
                onUpdateCourseMeta(course.id, {
                  name: editMeta.name.trim() || course.name,
                  target_audience: editMeta.target_audience || undefined,
                  prerequisites: crossPrerequisites,
                  next_courses: crossNextCourses,
                });
                setMetaDialogOpen(false);
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PaneWheelRoot>
  );
}
