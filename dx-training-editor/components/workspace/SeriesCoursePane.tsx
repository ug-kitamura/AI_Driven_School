"use client";

import { useState, useMemo } from "react";
import { GraduationCap, ChevronDown, ChevronRight } from "lucide-react";
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
import type { Series } from "@/lib/schema";

type Props = {
  workspaceName: string;
  series: Series[];
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
};

const STATUS_BADGE_CLASS = {
  done: "bg-[--status-done] text-white border-transparent hover:bg-[--status-done]",
  in_progress:
    "bg-[--status-wip] text-white border-transparent hover:bg-[--status-wip]",
  draft:
    "bg-[--status-draft] text-white border-transparent hover:bg-[--status-draft]",
};

export function SeriesCoursePane({
  workspaceName,
  series,
  selectedCourseId,
  onSelectCourse,
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

                {/* コース一覧 */}
                {isExpanded && (
                  <div className="ml-3 space-y-0.5">
                    {s.courses.map((c) => {
                      const courseStatus = computeStatus(
                        c.lessons.map((l) => l.status),
                      );
                      const isSelected = c.id === selectedCourseId;

                      return (
                        <button
                          key={c.id}
                          onClick={() => onSelectCourse(c.id)}
                          className={cn(
                            "flex w-full items-center justify-between gap-1 rounded-md px-2 py-1 text-left text-xs transition-colors",
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-accent",
                          )}
                        >
                          <span className="flex-1 truncate sidebar-label">
                            {c.name}
                          </span>
                          <Badge
                            className={cn(
                              "flex-shrink-0 px-1 py-0 text-[10px] sidebar-label",
                              STATUS_BADGE_CLASS[courseStatus],
                            )}
                          >
                            {STATUS_LABELS[courseStatus]}
                          </Badge>
                        </button>
                      );
                    })}
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
