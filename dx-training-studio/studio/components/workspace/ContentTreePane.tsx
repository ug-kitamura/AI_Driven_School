"use client";

import { useCallback, useRef, useState } from "react";
import {
  GraduationCap,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Loader,
  CircleDashed,
  Settings2,
  Pencil,
  Copy,
  ClipboardPaste,
  FolderOpen,
  FolderPlus,
  FilePlus,
  Trash2,
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
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MiniMandalaSection } from "@/components/workspace/MiniMandalaSection";
import { Pane1Toggle } from "@/components/workspace/Pane1Toggle";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import { NameDialog } from "@/components/workspace/NameDialog";
import { CourseMetaDialog } from "@/components/workspace/CourseMetaDialog";
import { LessonMetaDialog } from "@/components/workspace/LessonMetaDialog";
import { WorkspaceMetaDialog } from "@/components/workspace/WorkspaceMetaDialog";
import {
  LIST_ROW_SELECTED_CLASS,
  LIST_ROW_UNSELECTED_CLASS,
  LIST_ROW_X_INSET_CLASS,
  PANE_LIST_CONTENT_X_INSET_CLASS,
  SORTABLE_POINTER_ACTIVATION,
} from "@/components/workspace/constants";
import { cn } from "@/lib/utils";
import type { LessonMetaFields } from "@/lib/lesson-frontmatter";
import type { Series, Course, Lesson } from "@/lib/schema";

/** ステータス種別はラベルで区別。色は行の text-* を currentColor として継承する */
const STATUS_ICON: Record<
  Lesson["status"],
  { icon: React.ReactNode; label: string }
> = {
  done: { icon: <CircleCheck className="size-3.5" />, label: "完成" },
  in_progress: { icon: <Loader className="size-3.5" />, label: "作成中" },
  open: { icon: <CircleDashed className="size-3.5" />, label: "未着手" },
};

const STATUS_CYCLE: Record<Lesson["status"], Lesson["status"]> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

/** クリップボード（クライアント内 state）。名前で保持し API へそのまま渡す */
type ClipboardItem =
  | { type: "series"; series: string }
  | { type: "course"; series: string; course: string }
  | { type: "lesson"; series: string; course: string; lesson: string };

type DeleteTarget =
  | { kind: "series"; seriesItem: Series }
  | { kind: "course"; seriesItem: Series; course: Course }
  | { kind: "lesson"; course: Course; lesson: Lesson };

type Props = {
  workspaceName: string;
  series: Series[];
  selectedSeriesId: string;
  selectedCourseId: string;
  selectedLessonId: string;
  onSelectSeries: (seriesId: string) => void;
  onSelectCourse: (courseId: string) => void;
  onSelectLesson: (lessonId: string) => void;
  onReorderSeries: (fromIndex: number, toIndex: number) => void;
  onReorderCourses: (seriesId: string, fromIndex: number, toIndex: number) => void;
  onReorderLessons: (courseId: string, fromIndex: number, toIndex: number) => void;
  onAddSeries: (name: string) => string;
  onAddCourse: (seriesId: string, name: string) => void;
  onAddLesson: (courseId: string, name: string) => void;
  onDeleteSeries: (seriesId: string) => void;
  onDeleteCourse: (seriesId: string, courseId: string) => void;
  onDeleteLesson: (courseId: string, lessonId: string) => void;
  onUpdateSeriesName: (seriesId: string, name: string) => void;
  onUpdateCourseMeta: (
    courseId: string,
    meta: Pick<
      Course,
      | "name"
      | "target"
      | "style"
      | "cross_series_prev"
      | "cross_series_next"
      | "is_start"
      | "is_goal"
    >,
  ) => void;
  onUpdateLessonMeta: (lessonId: string, meta: Partial<LessonMetaFields>) => void;
  onUpdateLessonStatus: (lessonId: string, status: Lesson["status"]) => void;
  tagSuggestions: readonly string[];
  onSaveError?: (message: string) => void;
};

function courseRenamePatch(
  course: Course,
  name: string,
): Pick<
  Course,
  | "name"
  | "target"
  | "style"
  | "cross_series_prev"
  | "cross_series_next"
  | "is_start"
  | "is_goal"
> {
  return {
    name,
    target: course.target,
    style: course.style,
    cross_series_prev: course.cross_series_prev ?? [],
    cross_series_next: course.cross_series_next ?? [],
    is_start: course.is_start ?? false,
    is_goal: course.is_goal ?? false,
  };
}

export function ContentTreePane({
  workspaceName,
  series,
  selectedSeriesId,
  selectedCourseId,
  selectedLessonId,
  onSelectSeries,
  onSelectCourse,
  onSelectLesson,
  onReorderSeries,
  onReorderCourses,
  onReorderLessons,
  onAddSeries,
  onAddCourse,
  onAddLesson,
  onDeleteSeries,
  onDeleteCourse,
  onDeleteLesson,
  onUpdateSeriesName,
  onUpdateCourseMeta,
  onUpdateLessonMeta,
  onUpdateLessonStatus,
  tagSuggestions,
  onSaveError,
}: Props) {
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";
  const scrollRef = useRef<HTMLDivElement>(null);

  // 開閉は「畳んだものだけ」を覚える。追加・同期で現れた新ノードは自動的に展開状態になる
  const [collapsedSeriesIds, setCollapsedSeriesIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedCourseIds, setCollapsedCourseIds] = useState<Set<string>>(
    () => new Set(),
  );

  // コンテキストメニュー操作直後のポインター操作（貫通クリック等）を無視するガード
  // （EBEX FileTreePane と同じ機構）
  const menuGuardUntilRef = useRef(0);
  const armMenuGuard = useCallback(() => {
    menuGuardUntilRef.current = Date.now() + 300;
  }, []);
  const isMenuGuarded = useCallback(
    () => Date.now() < menuGuardUntilRef.current,
    [],
  );

  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);

  // ダイアログ state
  const [nameDialog, setNameDialog] = useState<{
    title: string;
    label: string;
    placeholder?: string;
    initialValue?: string;
    submitLabel?: string;
    onSubmit: (name: string) => void;
  } | null>(null);
  const [coursePropsId, setCoursePropsId] = useState<string | null>(null);
  const [lessonPropsId, setLessonPropsId] = useState<string | null>(null);
  const [workspacePropsOpen, setWorkspacePropsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: SORTABLE_POINTER_ACTIVATION,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const toggleSeries = (id: string) => {
    setCollapsedSeriesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCourse = (id: string) => {
    setCollapsedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSeriesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = series.findIndex((s) => s.id === active.id);
    const toIndex = series.findIndex((s) => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) onReorderSeries(fromIndex, toIndex);
  };

  const revealInOs = useCallback(
    (target: { series?: string; course?: string; lesson?: string }) => {
      fetch("/api/content/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      }).catch(() => {
        // 開けなくても致命ではない
      });
    },
    [],
  );

  const duplicateTo = useCallback(
    (payload: Record<string, string>) => {
      fetch("/api/content/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(data?.error ?? `HTTP ${res.status}`);
          }
          // 反映はコンテンツ同期（mtime 監視）が拾う
        })
        .catch((err: unknown) => {
          onSaveError?.(`複製エラー: ${String(err)}`);
        });
    },
    [onSaveError],
  );

  const findCourse = useCallback(
    (courseId: string): { seriesItem: Series; course: Course } | null => {
      for (const s of series) {
        const c = s.courses.find((c) => c.id === courseId);
        if (c) return { seriesItem: s, course: c };
      }
      return null;
    },
    [series],
  );

  const findLesson = useCallback(
    (
      lessonId: string,
    ): { seriesItem: Series; course: Course; lesson: Lesson } | null => {
      for (const s of series) {
        for (const c of s.courses) {
          const l = c.lessons.find((l) => l.id === lessonId);
          if (l) return { seriesItem: s, course: c, lesson: l };
        }
      }
      return null;
    },
    [series],
  );

  const propsCourse = coursePropsId ? findCourse(coursePropsId)?.course : undefined;
  const propsLesson = lessonPropsId ? findLesson(lessonPropsId)?.lesson : undefined;

  const openAddSeriesDialog = () => {
    setNameDialog({
      title: "シリーズを追加",
      label: "シリーズ名",
      placeholder: "例: GitHub Actions 完全マスターシリーズ",
      submitLabel: "追加",
      onSubmit: (name) => {
        onAddSeries(name);
      },
    });
  };

  const totalDeleteLabel = (t: DeleteTarget) =>
    t.kind === "series"
      ? t.seriesItem.name
      : t.kind === "course"
        ? t.course.name
        : t.lesson.lesson;

  const deleteBlocked = (t: DeleteTarget) =>
    t.kind === "series"
      ? t.seriesItem.courses.length > 0
      : t.kind === "course"
        ? t.course.lessons.length > 0
        : false;

  const performDelete = (t: DeleteTarget) => {
    if (t.kind === "series") onDeleteSeries(t.seriesItem.id);
    else if (t.kind === "course") onDeleteCourse(t.seriesItem.id, t.course.id);
    else onDeleteLesson(t.course.id, t.lesson.id);
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <PaneWheelRoot scrollRef={scrollRef} className="min-h-0 flex-1">
        <SidebarHeader className="flex h-12 shrink-0 flex-row items-center gap-0 border-b border-border px-3 py-0">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <GraduationCap className="h-5 w-5 flex-shrink-0 text-primary" />
              <span className="truncate text-sm font-bold text-foreground sidebar-label">
                {workspaceName}
              </span>
            </div>
            <Pane1Toggle />
          </div>
        </SidebarHeader>

        <SidebarContent
          ref={scrollRef}
          className={cn(
            "overflow-y-auto overscroll-y-contain py-2",
            PANE_LIST_CONTENT_X_INSET_CLASS,
          )}
        >
          {isCollapsed ? null : (
            <div className="flex min-h-full flex-col">
              {series.length > 0 && (
                <DndContext
                  id="tree-series-dnd"
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSeriesDragEnd}
                >
                  <SortableContext
                    items={series.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-0.5">
                      {series.map((s) => (
                        <SeriesNode
                          key={s.id}
                          seriesItem={s}
                          isExpanded={!collapsedSeriesIds.has(s.id)}
                          onToggle={() => toggleSeries(s.id)}
                          collapsedCourseIds={collapsedCourseIds}
                          onToggleCourse={toggleCourse}
                          selectedSeriesId={selectedSeriesId}
                          selectedCourseId={selectedCourseId}
                          selectedLessonId={selectedLessonId}
                          onSelectSeries={onSelectSeries}
                          onSelectCourse={onSelectCourse}
                          onSelectLesson={onSelectLesson}
                          onReorderCourses={onReorderCourses}
                          onReorderLessons={onReorderLessons}
                          onUpdateLessonStatus={onUpdateLessonStatus}
                          sensors={sensors}
                          clipboard={clipboard}
                          setClipboard={setClipboard}
                          duplicateTo={duplicateTo}
                          revealInOs={revealInOs}
                          armMenuGuard={armMenuGuard}
                          isMenuGuarded={isMenuGuarded}
                          setNameDialog={setNameDialog}
                          setCoursePropsId={setCoursePropsId}
                          setLessonPropsId={setLessonPropsId}
                          setDeleteTarget={setDeleteTarget}
                          onAddCourse={onAddCourse}
                          onAddLesson={onAddLesson}
                          onUpdateSeriesName={onUpdateSeriesName}
                          onUpdateCourseMeta={onUpdateCourseMeta}
                          onUpdateLessonMeta={onUpdateLessonMeta}
                          findCourse={findCourse}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* 空きスペース: ツリーの残り全域。右クリックで全体メニュー */}
              <ContextMenu>
                <ContextMenuTrigger
                  render={
                    <div className="min-h-10 flex-1">
                      {series.length === 0 && (
                        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                          シリーズがありません。
                          <br />
                          右クリックからシリーズを追加できます。
                        </p>
                      )}
                    </div>
                  }
                />
                <ContextMenuContent>
                  <ContextMenuItem
                    variant="muted"
                    onClick={() => {
                      armMenuGuard();
                      openAddSeriesDialog();
                    }}
                  >
                    <FolderPlus className="size-4" />
                    add series
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="muted"
                    onClick={() => {
                      armMenuGuard();
                      setWorkspacePropsOpen(true);
                    }}
                  >
                    <Settings2 className="size-4" />
                    properties
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="muted"
                    disabled={clipboard?.type !== "series"}
                    onClick={() => {
                      armMenuGuard();
                      if (clipboard?.type !== "series") return;
                      duplicateTo({ type: "series", series: clipboard.series });
                    }}
                  >
                    <ClipboardPaste className="size-4" />
                    paste
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="muted"
                    onClick={() => {
                      armMenuGuard();
                      revealInOs({});
                    }}
                  >
                    <FolderOpen className="size-4" />
                    open explorer
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </div>
          )}
        </SidebarContent>
      </PaneWheelRoot>

      {/* ミニ曼陀羅の下部固定領域（コース未選択時は畳む）。ツリーのスクロールと独立 */}
      {!isCollapsed && (
        <MiniMandalaSection
          series={series}
          course={
            selectedCourseId ? findCourse(selectedCourseId)?.course : undefined
          }
          onSelectCourse={onSelectCourse}
        />
      )}

      {/* ダイアログ群 */}
      {nameDialog && (
        <NameDialog
          open
          onOpenChange={(open) => {
            if (!open) setNameDialog(null);
          }}
          title={nameDialog.title}
          label={nameDialog.label}
          placeholder={nameDialog.placeholder}
          initialValue={nameDialog.initialValue}
          submitLabel={nameDialog.submitLabel}
          onSubmit={nameDialog.onSubmit}
        />
      )}

      <CourseMetaDialog
        open={coursePropsId != null}
        onOpenChange={(open) => {
          if (!open) setCoursePropsId(null);
        }}
        series={series}
        course={propsCourse}
        onSave={onUpdateCourseMeta}
      />

      <LessonMetaDialog
        open={lessonPropsId != null}
        onOpenChange={(open) => {
          if (!open) setLessonPropsId(null);
        }}
        lesson={propsLesson}
        onSave={onUpdateLessonMeta}
        tagSuggestions={tagSuggestions}
      />

      <WorkspaceMetaDialog
        open={workspacePropsOpen}
        onOpenChange={setWorkspacePropsOpen}
        onSaveError={onSaveError}
      />

      {/* 削除確認 / 削除不可 */}
      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        {deleteTarget && (
          <DialogContent>
            {deleteBlocked(deleteTarget) ? (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {deleteTarget.kind === "series"
                      ? "シリーズを削除できません"
                      : "コースを削除できません"}
                  </DialogTitle>
                  <DialogDescription>
                    {deleteTarget.kind === "series"
                      ? `「${deleteTarget.seriesItem.name}」にはコースが ${deleteTarget.seriesItem.courses.length} 件あります。先にコースを削除してください。`
                      : deleteTarget.kind === "course"
                        ? `「${deleteTarget.course.name}」にはレッスンが ${deleteTarget.course.lessons.length} 件あります。先にレッスンを削除してください。`
                        : ""}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => setDeleteTarget(null)}>閉じる</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {deleteTarget.kind === "series"
                      ? "シリーズを削除しますか？"
                      : deleteTarget.kind === "course"
                        ? "コースを削除しますか？"
                        : "レッスンを削除しますか？"}
                  </DialogTitle>
                  <DialogDescription>
                    「{totalDeleteLabel(deleteTarget)}
                    」を削除します。この操作は元に戻せません。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                    キャンセル
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      performDelete(deleteTarget);
                      setDeleteTarget(null);
                    }}
                  >
                    削除
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        )}
      </Dialog>
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// ツリーノード
// ---------------------------------------------------------------------------

type NodeSharedProps = {
  clipboard: ClipboardItem | null;
  setClipboard: (item: ClipboardItem | null) => void;
  duplicateTo: (payload: Record<string, string>) => void;
  revealInOs: (target: {
    series?: string;
    course?: string;
    lesson?: string;
  }) => void;
  armMenuGuard: () => void;
  isMenuGuarded: () => boolean;
  setNameDialog: (
    dialog: {
      title: string;
      label: string;
      placeholder?: string;
      initialValue?: string;
      submitLabel?: string;
      onSubmit: (name: string) => void;
    } | null,
  ) => void;
  setCoursePropsId: (id: string | null) => void;
  setLessonPropsId: (id: string | null) => void;
  setDeleteTarget: (target: DeleteTarget | null) => void;
};

function SeriesNode({
  seriesItem,
  isExpanded,
  onToggle,
  collapsedCourseIds,
  onToggleCourse,
  selectedSeriesId,
  selectedCourseId,
  selectedLessonId,
  onSelectSeries,
  onSelectCourse,
  onSelectLesson,
  onReorderCourses,
  onReorderLessons,
  onUpdateLessonStatus,
  sensors,
  onAddCourse,
  onAddLesson,
  onUpdateSeriesName,
  onUpdateCourseMeta,
  onUpdateLessonMeta,
  findCourse,
  ...shared
}: NodeSharedProps & {
  seriesItem: Series;
  isExpanded: boolean;
  onToggle: () => void;
  collapsedCourseIds: Set<string>;
  onToggleCourse: (id: string) => void;
  selectedSeriesId: string;
  selectedCourseId: string;
  selectedLessonId: string;
  onSelectSeries: (id: string) => void;
  onSelectCourse: (id: string) => void;
  onSelectLesson: (id: string) => void;
  onReorderCourses: (seriesId: string, from: number, to: number) => void;
  onReorderLessons: (courseId: string, from: number, to: number) => void;
  onUpdateLessonStatus: (lessonId: string, status: Lesson["status"]) => void;
  sensors: ReturnType<typeof useSensors>;
  onAddCourse: (seriesId: string, name: string) => void;
  onAddLesson: (courseId: string, name: string) => void;
  onUpdateSeriesName: (seriesId: string, name: string) => void;
  onUpdateCourseMeta: Props["onUpdateCourseMeta"];
  onUpdateLessonMeta: Props["onUpdateLessonMeta"];
  findCourse: (
    courseId: string,
  ) => { seriesItem: Series; course: Course } | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: seriesItem.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const allLessons = seriesItem.courses.flatMap((c) => c.lessons);
  const doneLessons = allLessons.filter((l) => l.status === "done").length;

  const isSeriesFocused = selectedSeriesId === seriesItem.id && !selectedCourseId;

  const handleCourseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = seriesItem.courses.findIndex((c) => c.id === active.id);
    const toIndex = seriesItem.courses.findIndex((c) => c.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderCourses(seriesItem.id, fromIndex, toIndex);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              className={cn(
                "group/tree-series flex w-full cursor-pointer items-center gap-0.5 rounded-md py-1 transition-colors",
                LIST_ROW_X_INSET_CLASS,
                isSeriesFocused
                  ? LIST_ROW_SELECTED_CLASS
                  : LIST_ROW_UNSELECTED_CLASS,
              )}
              onClick={() => {
                if (shared.isMenuGuarded()) return;
                onSelectSeries(seriesItem.id);
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (shared.isMenuGuarded()) return;
                  onToggle();
                }}
                className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/80"
                aria-label={isExpanded ? "シリーズを折りたたむ" : "シリーズを展開"}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              <span
                {...attributes}
                {...listeners}
                className="min-w-0 flex-1 truncate text-left text-xs font-bold group-hover/tree-series:cursor-grab active:cursor-grabbing sidebar-label"
              >
                {seriesItem.name}
              </span>
              {/* シリーズ配下の完了レッスン数 / 総レッスン数（右寄せ・青系） */}
              <span className="ml-auto flex-shrink-0 pr-1 text-[10px] font-medium text-primary sidebar-label">
                {doneLessons}/{allLessons.length}
              </span>
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              // シリーズの properties は現状シリーズ名のみ（4階層メタ編集 UI は次 change）
              shared.setNameDialog({
                title: "シリーズ名を編集",
                label: "シリーズ名",
                initialValue: seriesItem.name,
                onSubmit: (name) => onUpdateSeriesName(seriesItem.id, name),
              });
            }}
          >
            <Settings2 className="size-4" />
            properties
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "コースを追加",
                label: "コース名",
                placeholder: "例: Git 環境構築コース",
                submitLabel: "追加",
                onSubmit: (name) => onAddCourse(seriesItem.id, name),
              });
            }}
          >
            <FolderPlus className="size-4" />
            add course
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "シリーズ名を変更",
                label: "シリーズ名",
                initialValue: seriesItem.name,
                onSubmit: (name) => onUpdateSeriesName(seriesItem.id, name),
              });
            }}
          >
            <Pencil className="size-4" />
            rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setClipboard({ type: "series", series: seriesItem.name });
            }}
          >
            <Copy className="size-4" />
            copy
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            disabled={shared.clipboard?.type !== "course"}
            onClick={() => {
              shared.armMenuGuard();
              const clip = shared.clipboard;
              if (clip?.type !== "course") return;
              shared.duplicateTo({
                type: "course",
                series: clip.series,
                course: clip.course,
                targetSeries: seriesItem.name,
              });
            }}
          >
            <ClipboardPaste className="size-4" />
            paste
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.revealInOs({ series: seriesItem.name });
            }}
          >
            <FolderOpen className="size-4" />
            open explorer
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              shared.armMenuGuard();
              shared.setDeleteTarget({ kind: "series", seriesItem });
            }}
          >
            <Trash2 className="size-4" />
            delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && seriesItem.courses.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-4">
          <DndContext
            id={`tree-course-dnd-${seriesItem.id}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCourseDragEnd}
          >
            <SortableContext
              items={seriesItem.courses.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {seriesItem.courses.map((c) => (
                <CourseNode
                  key={c.id}
                  seriesItem={seriesItem}
                  course={c}
                  isExpanded={!collapsedCourseIds.has(c.id)}
                  onToggle={() => onToggleCourse(c.id)}
                  isSelected={c.id === selectedCourseId}
                  selectedLessonId={selectedLessonId}
                  onSelectCourse={onSelectCourse}
                  onSelectLesson={onSelectLesson}
                  onReorderLessons={onReorderLessons}
                  onUpdateLessonStatus={onUpdateLessonStatus}
                  sensors={sensors}
                  onAddLesson={onAddLesson}
                  onUpdateCourseMeta={onUpdateCourseMeta}
                  onUpdateLessonMeta={onUpdateLessonMeta}
                  findCourse={findCourse}
                  {...shared}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function CourseNode({
  seriesItem,
  course,
  isExpanded,
  onToggle,
  isSelected,
  selectedLessonId,
  onSelectCourse,
  onSelectLesson,
  onReorderLessons,
  onUpdateLessonStatus,
  sensors,
  onAddLesson,
  onUpdateCourseMeta,
  onUpdateLessonMeta,
  findCourse,
  ...shared
}: NodeSharedProps & {
  seriesItem: Series;
  course: Course;
  isExpanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
  selectedLessonId: string;
  onSelectCourse: (id: string) => void;
  onSelectLesson: (id: string) => void;
  onReorderLessons: (courseId: string, from: number, to: number) => void;
  onUpdateLessonStatus: (lessonId: string, status: Lesson["status"]) => void;
  sensors: ReturnType<typeof useSensors>;
  onAddLesson: (courseId: string, name: string) => void;
  onUpdateCourseMeta: Props["onUpdateCourseMeta"];
  onUpdateLessonMeta: Props["onUpdateLessonMeta"];
  findCourse: (
    courseId: string,
  ) => { seriesItem: Series; course: Course } | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: course.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleLessonDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = course.lessons.findIndex((l) => l.id === active.id);
    const toIndex = course.lessons.findIndex((l) => l.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderLessons(course.id, fromIndex, toIndex);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              className={cn(
                "group/tree-course flex w-full cursor-pointer items-center gap-0.5 rounded-md py-1 text-xs transition-colors",
                LIST_ROW_X_INSET_CLASS,
                isSelected ? LIST_ROW_SELECTED_CLASS : LIST_ROW_UNSELECTED_CLASS,
              )}
              onClick={() => {
                if (shared.isMenuGuarded()) return;
                onSelectCourse(course.id);
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (shared.isMenuGuarded()) return;
                  onToggle();
                }}
                className="flex-shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/80"
                aria-label={isExpanded ? "コースを折りたたむ" : "コースを展開"}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              <span
                {...attributes}
                {...listeners}
                className="min-w-0 flex-1 truncate text-left group-hover/tree-course:cursor-grab active:cursor-grabbing sidebar-label"
              >
                {course.name}
              </span>
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setCoursePropsId(course.id);
            }}
          >
            <Settings2 className="size-4" />
            properties
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "レッスンを追加",
                label: "レッスン名",
                placeholder: "例: Gitのインストール手順",
                submitLabel: "追加",
                onSubmit: (name) => onAddLesson(course.id, name),
              });
            }}
          >
            <FilePlus className="size-4" />
            add lesson
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "コース名を変更",
                label: "コース名",
                initialValue: course.name,
                onSubmit: (name) => {
                  const found = findCourse(course.id);
                  if (!found) return;
                  onUpdateCourseMeta(
                    course.id,
                    courseRenamePatch(found.course, name),
                  );
                },
              });
            }}
          >
            <Pencil className="size-4" />
            rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setClipboard({
                type: "course",
                series: seriesItem.name,
                course: course.name,
              });
            }}
          >
            <Copy className="size-4" />
            copy
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            disabled={shared.clipboard?.type !== "lesson"}
            onClick={() => {
              shared.armMenuGuard();
              const clip = shared.clipboard;
              if (clip?.type !== "lesson") return;
              shared.duplicateTo({
                type: "lesson",
                series: clip.series,
                course: clip.course,
                lesson: clip.lesson,
                targetSeries: seriesItem.name,
                targetCourse: course.name,
              });
            }}
          >
            <ClipboardPaste className="size-4" />
            paste
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.revealInOs({
                series: seriesItem.name,
                course: course.name,
              });
            }}
          >
            <FolderOpen className="size-4" />
            open explorer
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              shared.armMenuGuard();
              shared.setDeleteTarget({ kind: "course", seriesItem, course });
            }}
          >
            <Trash2 className="size-4" />
            delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && course.lessons.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-4">
          <DndContext
            id={`tree-lesson-dnd-${course.id}`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleLessonDragEnd}
          >
            <SortableContext
              items={course.lessons.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              {course.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  seriesItem={seriesItem}
                  course={course}
                  lesson={lesson}
                  isSelected={lesson.id === selectedLessonId}
                  onSelectLesson={onSelectLesson}
                  onUpdateLessonStatus={onUpdateLessonStatus}
                  onUpdateLessonMeta={onUpdateLessonMeta}
                  {...shared}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

function LessonRow({
  seriesItem,
  course,
  lesson,
  isSelected,
  onSelectLesson,
  onUpdateLessonStatus,
  onUpdateLessonMeta,
  ...shared
}: NodeSharedProps & {
  seriesItem: Series;
  course: Course;
  lesson: Lesson;
  isSelected: boolean;
  onSelectLesson: (id: string) => void;
  onUpdateLessonStatus: (lessonId: string, status: Lesson["status"]) => void;
  onUpdateLessonMeta: Props["onUpdateLessonMeta"];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              className={cn(
                "group/tree-lesson flex w-full cursor-pointer items-center gap-1 rounded-md py-1 text-xs transition-colors",
                LIST_ROW_X_INSET_CLASS,
                isSelected ? LIST_ROW_SELECTED_CLASS : LIST_ROW_UNSELECTED_CLASS,
              )}
              onClick={() => {
                if (shared.isMenuGuarded()) return;
                onSelectLesson(lesson.id);
              }}
            >
              <span
                {...attributes}
                {...listeners}
                className="min-w-0 flex-1 truncate text-left group-hover/tree-lesson:cursor-grab active:cursor-grabbing sidebar-label"
              >
                {lesson.lesson}
              </span>
              {/* ステータスボタン（右寄せ・クリックで循環。行選択は発生させない） */}
              <WorkspaceTooltip
                label={STATUS_ICON[lesson.status].label}
                render={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (shared.isMenuGuarded()) return;
                      onUpdateLessonStatus(lesson.id, STATUS_CYCLE[lesson.status]);
                    }}
                    className="ml-auto flex-shrink-0 pr-1 transition-opacity hover:opacity-70 sidebar-label"
                    aria-label={`${STATUS_ICON[lesson.status].label}、クリックで変更`}
                  >
                    {STATUS_ICON[lesson.status].icon}
                  </button>
                }
              />
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setLessonPropsId(lesson.id);
            }}
          >
            <Settings2 className="size-4" />
            properties
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setNameDialog({
                title: "レッスン名を変更",
                label: "レッスン名",
                initialValue: lesson.lesson,
                onSubmit: (name) => onUpdateLessonMeta(lesson.id, { lesson: name }),
              });
            }}
          >
            <Pencil className="size-4" />
            rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.setClipboard({
                type: "lesson",
                series: seriesItem.name,
                course: course.name,
                lesson: lesson.lesson,
              });
            }}
          >
            <Copy className="size-4" />
            copy
          </ContextMenuItem>
          <ContextMenuItem
            variant="muted"
            onClick={() => {
              shared.armMenuGuard();
              shared.revealInOs({
                series: seriesItem.name,
                course: course.name,
                lesson: lesson.lesson,
              });
            }}
          >
            <FolderOpen className="size-4" />
            open explorer
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => {
              shared.armMenuGuard();
              shared.setDeleteTarget({ kind: "lesson", course, lesson });
            }}
          >
            <Trash2 className="size-4" />
            delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
