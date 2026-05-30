"use client";

import { useState } from "react";
import {
  GraduationCap,
  ChevronDown,
  ChevronRight,
  GripVertical,
  CircleCheck,
  Loader,
  CircleDashed,
  Plus,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pane1Toggle } from "@/components/workspace/Pane1Toggle";
import { ADD_LIST_BUTTON_CLASS } from "@/components/workspace/constants";
import { Progress } from "@/components/ui/progress";
import { cn, computeStatus } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/schema";
import type { Series, Course } from "@/lib/schema";

type Props = {
  workspaceName: string;
  series: Series[];
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
  onReorderCourses: (seriesId: string, fromIndex: number, toIndex: number) => void;
  onAddSeries: (name: string) => string;
  onAddCourse: (seriesId: string, name: string) => void;
};

const STATUS_ICON = {
  done: <CircleCheck className="h-3.5 w-3.5 text-[--status-done]" />,
  in_progress: <Loader className="h-3.5 w-3.5 text-[--status-wip]" />,
  draft: <CircleDashed className="h-3.5 w-3.5 text-[--status-draft]" />,
} as const;

function SortableCourseRow({
  course,
  isSelected,
  onSelect,
}: {
  course: Course;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: course.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const courseStatus = computeStatus(course.lessons.map((l) => l.status));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
        isSelected
          ? "bg-accent text-primary"
          : "text-foreground hover:bg-muted",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100"
        tabIndex={-1}
      >
        <GripVertical className="h-3 w-3" />
      </button>

      <button onClick={onSelect} className="flex-1 truncate text-left sidebar-label">
        {course.name}
      </button>

      <span
        className="flex-shrink-0 sidebar-label"
        title={STATUS_LABELS[courseStatus]}
      >
        {STATUS_ICON[courseStatus]}
      </span>
    </div>
  );
}

export function SeriesCoursePane({
  workspaceName,
  series,
  selectedCourseId,
  onSelectCourse,
  onReorderCourses,
  onAddSeries,
  onAddCourse,
}: Props) {
  const [expandedSeriesIds, setExpandedSeriesIds] = useState<Set<string>>(
    () => new Set(series.map((s) => s.id)),
  );

  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";

  const [addSeriesOpen, setAddSeriesOpen] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");

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

  const expandSeries = (id: string) => {
    setExpandedSeriesIds((prev) => new Set([...prev, id]));
  };

  const handleAddSeries = (name: string) => {
    const newId = onAddSeries(name);
    expandSeries(newId);
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (seriesId: string, courses: Series["courses"]) =>
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const fromIndex = courses.findIndex((c) => c.id === active.id);
      const toIndex = courses.findIndex((c) => c.id === over.id);
      if (fromIndex !== -1 && toIndex !== -1) {
        onReorderCourses(seriesId, fromIndex, toIndex);
      }
    };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
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

      <SidebarContent className="overflow-y-auto px-2 py-2">
        {isCollapsed ? null : (
          <>
            {series.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                シリーズがありません。
                <br />
                最初のシリーズを追加して開始してください。
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {series.map((s) => {
                  const isExpanded = expandedSeriesIds.has(s.id);
                  const totalCourses = s.courses.length;
                  const doneCourses = s.courses.filter(
                    (c) =>
                      computeStatus(c.lessons.map((l) => l.status)) === "done",
                  ).length;
                  const seriesProgress =
                    totalCourses > 0
                      ? Math.round((doneCourses / totalCourses) * 100)
                      : 0;

                  return (
                    <div key={s.id}>
                      <div className="flex items-center">
                        <button
                          onClick={() => toggleSeries(s.id)}
                          className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          )}
                          <span className="flex-1 truncate text-xs font-bold text-foreground sidebar-label">
                            {s.name}
                          </span>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mb-2 ml-3 px-2 sidebar-label">
                          <div className="mb-0.5 flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">
                              シリーズ進捗
                            </span>
                            <span className="font-medium text-primary">
                              {doneCourses}/{totalCourses}
                            </span>
                          </div>
                          <Progress value={seriesProgress} className="h-1" />
                        </div>
                      )}

                      {isExpanded && (
                        <div className="ml-3 flex flex-col gap-1">
                          <DndContext
                            id={`series-course-dnd-${s.id}`}
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd(s.id, s.courses)}
                          >
                            <SortableContext
                              items={s.courses.map((c) => c.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="flex flex-col gap-1">
                                {s.courses.map((c) => (
                                  <SortableCourseRow
                                    key={c.id}
                                    course={c}
                                    isSelected={c.id === selectedCourseId}
                                    onSelect={() => onSelectCourse(c.id)}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={ADD_LIST_BUTTON_CLASS}
                            onClick={() => openAddCourseDialog(s.id)}
                          >
                            <Plus className="h-3 w-3" />
                            コースを追加
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="shrink-0 gap-0 p-2">
        {isCollapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mx-auto size-7"
            onClick={openAddSeriesDialog}
            aria-label="シリーズを追加"
            title="シリーズを追加"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only">シリーズを追加</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className={ADD_LIST_BUTTON_CLASS}
            onClick={openAddSeriesDialog}
          >
            <Plus className="h-3 w-3" />
            シリーズを追加
          </Button>
        )}
      </SidebarFooter>

      <Dialog open={addSeriesOpen} onOpenChange={setAddSeriesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>シリーズを追加</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="series-name">シリーズ名</Label>
            <Input
              id="series-name"
              value={newSeriesName}
              onChange={(e) => setNewSeriesName(e.target.value)}
              placeholder="例: GitHub Actions 完全マスターシリーズ"
              className="mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSeriesName.trim()) {
                  handleAddSeries(newSeriesName.trim());
                  setAddSeriesOpen(false);
                }
              }}
            />
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
          <div className="py-2">
            <Label htmlFor="course-name">コース名</Label>
            <Input
              id="course-name"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="例: Git 環境構築コース"
              className="mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCourseName.trim()) {
                  onAddCourse(addCourseSeriesId, newCourseName.trim());
                  setAddCourseOpen(false);
                }
              }}
            />
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
    </Sidebar>
  );
}
