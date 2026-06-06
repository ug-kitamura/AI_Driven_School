"use client";

import { useState, useRef } from "react";
import {
  GraduationCap,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Loader,
  CircleDashed,
  Plus,
  Trash2,
  Edit3,
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
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pane1Toggle } from "@/components/workspace/Pane1Toggle";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import {
  ADD_LIST_BUTTON_CLASS,
  SORTABLE_POINTER_ACTIVATION,
} from "@/components/workspace/constants";
import { Progress } from "@/components/ui/progress";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_FORM,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import { cn, computeStatus } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/schema";
import type { Series, Course } from "@/lib/schema";

/** 子ブロック左のみインデント。右端はシリーズ行と揃える */
const SERIES_CHILD_INSET = "ml-3 pl-2";

type Props = {
  workspaceName: string;
  series: Series[];
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
  onReorderSeries: (fromIndex: number, toIndex: number) => void;
  onReorderCourses: (seriesId: string, fromIndex: number, toIndex: number) => void;
  onAddSeries: (name: string) => string;
  onAddCourse: (seriesId: string, name: string) => void;
  onDeleteSeries: (seriesId: string) => void;
  onDeleteCourse: (seriesId: string, courseId: string) => void;
  onUpdateSeriesName: (seriesId: string, name: string) => void;
};

const STATUS_ICON = {
  done: <CircleCheck className="h-3.5 w-3.5 text-[--status-done]" />,
  in_progress: <Loader className="h-3.5 w-3.5 text-[--status-wip]" />,
  open: <CircleDashed className="h-3.5 w-3.5 text-[--status-draft]" />,
} as const;

function SortableCourseRow({
  course,
  isSelected,
  onSelect,
  onDelete,
}: {
  course: Course;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: course.id });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const hasLessons = course.lessons.length > 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const courseStatus = computeStatus(course.lessons.map((l) => l.status));

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasLessons) setBlockedOpen(true);
    else setConfirmOpen(true);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onClick={onSelect}
        className={cn(
          "group/course-row flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 text-xs transition-colors",
          isSelected
            ? "bg-muted text-primary dark:bg-accent dark:text-primary"
            : "text-foreground hover:bg-muted",
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
          className="flex-1 truncate text-left sidebar-label group-hover/course-row:cursor-grab active:cursor-grabbing"
        >
          {course.name}
        </span>

        <WorkspaceTooltip
          label={
            hasLessons
              ? "レッスンがあるため削除できません"
              : "コースを削除"
          }
          render={
            <button
              type="button"
              onClick={handleDeleteClick}
              className="flex-shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover/course-row:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          }
        />

        <WorkspaceTooltip
          label={STATUS_LABELS[courseStatus]}
          render={
            <span className="ml-1 flex-shrink-0">
              {STATUS_ICON[courseStatus]}
            </span>
          }
        />
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>コースを削除しますか？</DialogTitle>
            <DialogDescription>
              「{course.name}」を削除します。この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete();
                setConfirmOpen(false);
              }}
            >
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>コースを削除できません</DialogTitle>
            <DialogDescription>
              「{course.name}」にはレッスンが {course.lessons.length}{" "}
              件あります。先にレッスンを削除してください。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setBlockedOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SortableSeriesBlock({
  seriesItem,
  isExpanded,
  onToggle,
  onDelete,
  onEditSeries,
  selectedCourseId,
  onSelectCourse,
  onDeleteCourse,
  onReorderCourses,
  openAddCourseDialog,
  sensors,
}: {
  seriesItem: Series;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEditSeries: () => void;
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
  onDeleteCourse: (seriesId: string, courseId: string) => void;
  onReorderCourses: (seriesId: string, from: number, to: number) => void;
  openAddCourseDialog: (seriesId: string) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: seriesItem.id });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const hasCourses = seriesItem.courses.length > 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasCourses) setBlockedOpen(true);
    else setConfirmOpen(true);
  };

  const handleCourseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = seriesItem.courses.findIndex((c) => c.id === active.id);
    const toIndex = seriesItem.courses.findIndex((c) => c.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderCourses(seriesItem.id, fromIndex, toIndex);
    }
  };

  const totalCourses = seriesItem.courses.length;
  const doneCourses = seriesItem.courses.filter(
    (c) => computeStatus(c.lessons.map((l) => l.status)) === "done",
  ).length;
  const seriesProgress =
    totalCourses > 0 ? Math.round((doneCourses / totalCourses) * 100) : 0;

  return (
    <>
      <div ref={setNodeRef} style={style}>
        <div className="group/series flex w-full items-center rounded-md transition-colors hover:bg-muted">
          <WorkspaceTooltip
            label={isExpanded ? "シリーズを折りたたむ" : "シリーズを展開"}
            render={
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className="flex-shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted/80"
                aria-label={isExpanded ? "シリーズを折りたたむ" : "シリーズを展開"}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            }
          />
          <span
            {...attributes}
            {...listeners}
            className="min-w-0 flex-1 truncate rounded px-1 py-1.5 text-xs font-bold text-foreground transition-colors group-hover/series:cursor-grab group-hover/series:bg-muted/60 group-hover/series:text-primary active:cursor-grabbing sidebar-label"
          >
            {seriesItem.name}
          </span>
          <div className="flex shrink-0 items-center sidebar-label">
            <WorkspaceTooltip
              label={
                hasCourses
                  ? "コースがあるため削除できません"
                  : "シリーズを削除"
              }
              render={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick(e);
                  }}
                  className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted/80 hover:text-destructive group-hover/series:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              }
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditSeries();
              }}
              aria-label="シリーズ名を編集"
              className="rounded p-1 text-foreground transition-colors hover:bg-muted/80 group-hover/series:text-primary"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className={cn("mb-2 sidebar-label", SERIES_CHILD_INSET)}>
            <div className="mb-0.5 flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">シリーズ進捗</span>
              <span className="font-medium text-primary">
                {doneCourses}/{totalCourses}
              </span>
            </div>
            <Progress value={seriesProgress} className="h-1 w-full gap-0" />
          </div>
        )}

        {isExpanded && (
          <div className={cn("flex flex-col gap-1", SERIES_CHILD_INSET)}>
            <DndContext
              id={`series-course-dnd-${seriesItem.id}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCourseDragEnd}
            >
              <SortableContext
                items={seriesItem.courses.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1">
                  {seriesItem.courses.map((c) => (
                    <SortableCourseRow
                      key={c.id}
                      course={c}
                      isSelected={c.id === selectedCourseId}
                      onSelect={() => onSelectCourse(c.id)}
                      onDelete={() => onDeleteCourse(seriesItem.id, c.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <Button
              variant="ghost"
              size="sm"
              className={ADD_LIST_BUTTON_CLASS}
              onClick={() => openAddCourseDialog(seriesItem.id)}
            >
              コースを追加
              <Plus className="h-3 w-3 shrink-0" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>シリーズを削除しますか？</DialogTitle>
            <DialogDescription>
              「{seriesItem.name}」を削除します。この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete();
                setConfirmOpen(false);
              }}
            >
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>シリーズを削除できません</DialogTitle>
            <DialogDescription>
              「{seriesItem.name}」にはコースが {seriesItem.courses.length}{" "}
              件あります。先にコースを削除してください。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setBlockedOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SeriesCoursePane({
  workspaceName,
  series,
  selectedCourseId,
  onSelectCourse,
  onReorderSeries,
  onReorderCourses,
  onAddSeries,
  onAddCourse,
  onDeleteSeries,
  onDeleteCourse,
  onUpdateSeriesName,
}: Props) {
  const [expandedSeriesIds, setExpandedSeriesIds] = useState<Set<string>>(
    () => new Set(series.map((s) => s.id)),
  );

  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";

  const [addSeriesOpen, setAddSeriesOpen] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");

  const [editSeriesOpen, setEditSeriesOpen] = useState(false);
  const [editSeriesId, setEditSeriesId] = useState("");
  const [editSeriesName, setEditSeriesName] = useState("");

  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addCourseSeriesId, setAddCourseSeriesId] = useState("");
  const [newCourseName, setNewCourseName] = useState("");

  const openAddSeriesDialog = () => {
    setNewSeriesName("");
    setAddSeriesOpen(true);
  };

  const openAddCourseDialog = (seriesId: string) => {
    setAddCourseSeriesId(seriesId);
    setNewCourseName("");
    setAddCourseOpen(true);
  };

  const openEditSeriesDialog = (seriesId: string) => {
    const target = series.find((s) => s.id === seriesId);
    if (!target) return;
    setEditSeriesId(seriesId);
    setEditSeriesName(target.name);
    setEditSeriesOpen(true);
  };

  const expandSeries = (id: string) => {
    setExpandedSeriesIds((prev) => new Set([...prev, id]));
  };

  const handleAddSeries = (name: string) => {
    const newId = onAddSeries(name);
    expandSeries(newId);
  };

  const handleDeleteSeries = (seriesId: string) => {
    onDeleteSeries(seriesId);
    setExpandedSeriesIds((prev) => {
      const next = new Set(prev);
      next.delete(seriesId);
      return next;
    });
  };

  const toggleSeries = (id: string) => {
    setExpandedSeriesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const seriesScrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: SORTABLE_POINTER_ACTIVATION,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleSeriesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = series.findIndex((s) => s.id === active.id);
    const toIndex = series.findIndex((s) => s.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderSeries(fromIndex, toIndex);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <PaneWheelRoot
        scrollRef={seriesScrollRef}
        className="min-h-0 flex-1"
      >
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
          ref={seriesScrollRef}
          className="overflow-y-auto overscroll-y-contain px-2 py-2"
        >
        {isCollapsed ? null : (
          <>
            {series.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                シリーズがありません。
                <br />
                最初のシリーズを追加して開始してください。
              </p>
            ) : (
              <DndContext
                id="series-list-dnd"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSeriesDragEnd}
              >
                <SortableContext
                  items={series.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-3">
                    {series.map((s) => (
                      <SortableSeriesBlock
                        key={s.id}
                        seriesItem={s}
                        isExpanded={expandedSeriesIds.has(s.id)}
                        onToggle={() => toggleSeries(s.id)}
                        onDelete={() => handleDeleteSeries(s.id)}
                        onEditSeries={() => openEditSeriesDialog(s.id)}
                        selectedCourseId={selectedCourseId}
                        onSelectCourse={onSelectCourse}
                        onDeleteCourse={onDeleteCourse}
                        onReorderCourses={onReorderCourses}
                        openAddCourseDialog={openAddCourseDialog}
                        sensors={sensors}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="shrink-0 gap-0 p-2">
        {isCollapsed ? (
          <WorkspaceTooltip
            label="シリーズを追加"
            side="right"
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mx-auto size-7"
                onClick={openAddSeriesDialog}
                aria-label="シリーズを追加"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="sr-only">シリーズを追加</span>
              </Button>
            }
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className={ADD_LIST_BUTTON_CLASS}
            onClick={openAddSeriesDialog}
          >
            シリーズを追加
            <Plus className="h-3 w-3 shrink-0" />
          </Button>
        )}
      </SidebarFooter>
      </PaneWheelRoot>

      <Dialog open={addSeriesOpen} onOpenChange={setAddSeriesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>シリーズを追加</DialogTitle>
          </DialogHeader>
          <div className={META_DIALOG_FORM}>
            <MetaDialogField>
              <Label htmlFor="series-name">シリーズ名</Label>
              <Input
                id="series-name"
                value={newSeriesName}
                onChange={(e) => setNewSeriesName(e.target.value)}
                placeholder="例: GitHub Actions 完全マスターシリーズ"
                className={META_DIALOG_CONTROL}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSeriesName.trim()) {
                    handleAddSeries(newSeriesName.trim());
                    setAddSeriesOpen(false);
                  }
                }}
              />
            </MetaDialogField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSeriesOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (newSeriesName.trim()) {
                  handleAddSeries(newSeriesName.trim());
                  setAddSeriesOpen(false);
                }
              }}
              disabled={!newSeriesName.trim()}
            >
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addCourseOpen} onOpenChange={setAddCourseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>コースを追加</DialogTitle>
          </DialogHeader>
          <div className={META_DIALOG_FORM}>
            <MetaDialogField>
              <Label htmlFor="course-name">コース名</Label>
              <Input
                id="course-name"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="例: Git 環境構築コース"
                className={META_DIALOG_CONTROL}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCourseName.trim()) {
                    onAddCourse(addCourseSeriesId, newCourseName.trim());
                    setAddCourseOpen(false);
                  }
                }}
              />
            </MetaDialogField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCourseOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (newCourseName.trim()) {
                  onAddCourse(addCourseSeriesId, newCourseName.trim());
                  setAddCourseOpen(false);
                }
              }}
              disabled={!newCourseName.trim()}
            >
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editSeriesOpen} onOpenChange={setEditSeriesOpen}>
        <DialogContent>
          <DialogHeader className="sr-only">
            <DialogTitle>シリーズ名を編集</DialogTitle>
          </DialogHeader>
          <div className={META_DIALOG_FORM}>
            <MetaDialogField>
              <Label htmlFor="edit-series-name">シリーズ名</Label>
              <Input
                id="edit-series-name"
                value={editSeriesName}
                onChange={(e) => setEditSeriesName(e.target.value)}
                className={META_DIALOG_CONTROL}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editSeriesName.trim()) {
                    onUpdateSeriesName(
                      editSeriesId,
                      editSeriesName.trim(),
                    );
                    setEditSeriesOpen(false);
                  }
                }}
              />
            </MetaDialogField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSeriesOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                const trimmed = editSeriesName.trim();
                if (!trimmed) return;
                onUpdateSeriesName(editSeriesId, trimmed);
                setEditSeriesOpen(false);
              }}
              disabled={!editSeriesName.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
