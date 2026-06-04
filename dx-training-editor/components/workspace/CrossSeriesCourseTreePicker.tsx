"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export type CrossSeriesCourseCandidate = {
  id: string;
  name: string;
  seriesName: string;
};

/** candidates は listCrossSeriesCourseCandidates の Pane1 順を維持する */
function groupBySeriesPane1Order(
  candidates: readonly CrossSeriesCourseCandidate[],
): Array<{ seriesName: string; courses: CrossSeriesCourseCandidate[] }> {
  const groups: Array<{
    seriesName: string;
    courses: CrossSeriesCourseCandidate[];
  }> = [];
  const indexBySeries = new Map<string, number>();

  for (const c of candidates) {
    const idx = indexBySeries.get(c.seriesName);
    if (idx === undefined) {
      indexBySeries.set(c.seriesName, groups.length);
      groups.push({ seriesName: c.seriesName, courses: [c] });
    } else {
      groups[idx].courses.push(c);
    }
  }
  return groups;
}

/** 同一シリーズからは最大1コースのみ選択可能 */
export function toggleCrossSeriesSelection(
  selectedIds: string[],
  courseId: string,
  candidates: readonly CrossSeriesCourseCandidate[],
): string[] {
  const target = candidates.find((c) => c.id === courseId);
  if (!target) return selectedIds;

  const withoutSeries = selectedIds.filter((id) => {
    const other = candidates.find((c) => c.id === id);
    return other?.seriesName !== target.seriesName;
  });

  if (selectedIds.includes(courseId)) {
    return withoutSeries;
  }
  return [...withoutSeries, courseId];
}

type Props = {
  candidates: readonly CrossSeriesCourseCandidate[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
  emptyMessage?: string;
};

export function CrossSeriesCourseTreePicker({
  candidates,
  selectedIds,
  onChange,
  className,
  emptyMessage = "選択できる別シリーズのコースがありません",
}: Props) {
  const groups = useMemo(
    () => groupBySeriesPane1Order(candidates),
    [candidates],
  );

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{emptyMessage}</p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-[11px] text-muted-foreground">
        各シリーズから1コースまで選択できます
      </p>
      <ScrollArea className="h-80 max-h-[min(24rem,48vh)] rounded-md border border-border bg-card">
        <div className="divide-y divide-border/70">
          {groups.map(({ seriesName, courses }) => (
            <div key={seriesName}>
              <div className="bg-muted px-3 py-2 text-xs font-semibold text-foreground">
                {seriesName}
              </div>
              <ul className="py-0.5">
                {courses.map((course) => {
                  const checked = selectedIds.includes(course.id);
                  return (
                    <li key={course.id}>
                      <label
                        className="flex cursor-pointer items-center gap-2.5 py-1.5 pl-5 pr-3 text-sm transition-colors hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 shrink-0 accent-primary"
                          checked={checked}
                          onChange={() =>
                            onChange(
                              toggleCrossSeriesSelection(
                                selectedIds,
                                course.id,
                                candidates,
                              ),
                            )
                          }
                        />
                        <span className="min-w-0 leading-snug">{course.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
