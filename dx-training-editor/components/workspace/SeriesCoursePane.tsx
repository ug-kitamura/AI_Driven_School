"use client";

import { useState, useMemo } from "react";
import { GraduationCap, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Pane1Toggle } from "@/components/workspace/Pane1Toggle";
import { Badge } from "@/components/ui/badge";
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
};

const STATUS_BADGE_CLASS = {
  done: "bg-[--status-done] text-white border-transparent hover:bg-[--status-done]",
  in_progress:
    "bg-[--status-wip] text-white border-transparent hover:bg-[--status-wip]",
  draft:
    "bg-[--status-draft] text-white border-transparent hover:bg-[--status-draft]",
};

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
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-accent",
      )}
    >
      {/* ドラッグハンドル */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100"
        tabIndex={-1}
      >
        <GripVertical className="h-3 w-3" />
      </button>

      {/* コース名 */}
      <button onClick={onSelect} className="flex-1 truncate text-left sidebar-label">
        {course.name}
      </button>

      {/* ステータスバッジ */}
      <Badge
        className={cn(
          "flex-shrink-0 px-1 py-0 text-[10px] sidebar-label",
          STATUS_BADGE_CLASS[courseStatus],
        )}
      >
        {STATUS_LABELS[courseStatus]}
      </Badge>
    </div>
  );
}

export function SeriesCoursePane({
  workspaceName,
  series,
  selectedCourseId,
  onSelectCourse,
  onReorderCourses,
}: Props) {
  const [expandedSeriesIds, setExpandedSeriesIds] = useState<Set<string>>(
    () => new Set(series.map((s) => s.id)),
  );

  const toggleSeries = (id: string) => {
    setExpandedSeriesIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  // グローバル進捗（全シリーズ横断）
  const { totalLessons, doneLessons } = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const s of series) {
      for (const c of s.courses) {
        for (const l of c.lessons) {
          total++;
          if (l.status === "done") done++;
        }
      }
    }
    return { totalLessons: total, doneLessons: done };
  }, [series]);

  const globalProgress =
    totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="border-b border-border px-3 py-3">
        <div className="flex items-center justify-between">
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
        {/* グローバル進捗バー */}
        <div className="mb-3 rounded-lg bg-card px-3 py-2 shadow-xs sidebar-label">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">全体進捗</span>
            <span className="font-medium text-primary">
              {doneLessons} / {totalLessons}
            </span>
          </div>
          <Progress value={globalProgress} className="h-1.5" />
        </div>

        {/* シリーズ一覧 */}
        <div className="space-y-1">
          {series.map((s) => {
            const isExpanded = expandedSeriesIds.has(s.id);
            // シリーズの進捗
            const seriesLessons = s.courses.flatMap((c) => c.lessons);
            const seriesDone = seriesLessons.filter(
              (l) => l.status === "done",
            ).length;
            const seriesProgress =
              seriesLessons.length > 0
                ? Math.round((seriesDone / seriesLessons.length) * 100)
                : 0;

            return (
              <div key={s.id}>
                {/* シリーズ見出し */}
                <button
                  onClick={() => toggleSeries(s.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
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

                {/* シリーズ進捗バー */}
                {isExpanded && (
                  <div className="mb-1 px-5 sidebar-label">
                    <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        {seriesDone}/{seriesLessons.length} レッスン
                      </span>
                    </div>
                    <Progress value={seriesProgress} className="h-1" />
                  </div>
                )}

                {/* コース一覧（DnD 並び替え） */}
                {isExpanded && (
                  <div className="ml-3">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd(s.id, s.courses)}
                    >
                      <SortableContext
                        items={s.courses.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-0.5">
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
