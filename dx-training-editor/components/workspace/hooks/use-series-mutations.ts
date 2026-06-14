"use client";

import { useCallback } from "react";
import type { Course, Series } from "@/lib/schema";

async function saveCourseMeta(
  seriesName: string,
  courseName: string,
  meta: Pick<Course, "target_audience" | "prerequisites" | "next_courses">,
): Promise<void> {
  const res = await fetch("/api/content/save-course", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      series: seriesName,
      course: courseName,
      target_audience: meta.target_audience ?? "",
      prerequisites: meta.prerequisites,
      next_courses: meta.next_courses,
    }),
  });
  if (!res.ok) throw new Error("コースメタ保存エラー");
}

async function saveSeriesOrder(seriesNames: string[]): Promise<void> {
  const res = await fetch("/api/content/save-series-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order: seriesNames }),
  });
  if (!res.ok) throw new Error("シリーズ順序保存エラー");
}

async function callContentApi(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`/api/content/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({ error: "APIエラー" }))) as {
      error: string;
    };
    throw new Error(error);
  }
}
import {
  applyCourseDeletion,
  applyCrossSeriesCourseMetaEdit,
  applySeriesDeletion,
  filterCrossSeriesIds,
} from "@/lib/course-flow";
import { reconcileLesson } from "@/lib/lesson-frontmatter";
import {
  resolveSelectionAfterDelete,
  type WorkspaceSelection,
} from "@/lib/workspace-selection";

export function useSeriesMutations(options: {
  series: Series[];
  setSeries: React.Dispatch<React.SetStateAction<Series[]>>;
  selectedCourseId: string;
  selectedLessonId: string;
  setSelection: (selection: WorkspaceSelection) => void;
  onSaveError?: (msg: string) => void;
}) {
  const { series, setSeries, selectedCourseId, selectedLessonId, setSelection, onSaveError } =
    options;

  const addSeries = useCallback(
    (name: string) => {
      const newId = `series-${name}`;
      setSeries((prev) => [...prev, { id: newId, name, courses: [] }]);
      callContentApi("create", { type: "series", name }).catch((err: unknown) => {
        onSaveError?.(`シリーズ追加エラー: ${String(err)}`);
      });
      return newId;
    },
    [setSeries, onSaveError],
  );

  const deleteSeries = useCallback(
    (seriesId: string) => {
      const target = series.find((s) => s.id === seriesId);
      const next = applySeriesDeletion(series, seriesId);
      const selection = resolveSelectionAfterDelete({
        prevSeries: series,
        nextSeries: next,
        selectedCourseId,
        selectedLessonId,
        deleted: { kind: "series", seriesId },
      });
      setSeries(next);
      setSelection(selection);
      if (target) {
        callContentApi("delete", { type: "series", name: target.name }).catch(
          (err: unknown) => onSaveError?.(`シリーズ削除エラー: ${String(err)}`),
        );
      }
    },
    [series, selectedCourseId, selectedLessonId, setSeries, setSelection, onSaveError],
  );

  const deleteCourse = useCallback(
    (seriesId: string, courseId: string) => {
      const targetSeries = series.find((s) => s.id === seriesId);
      const targetCourse = targetSeries?.courses.find((c) => c.id === courseId);
      const next = applyCourseDeletion(series, seriesId, courseId);
      const selection = resolveSelectionAfterDelete({
        prevSeries: series,
        nextSeries: next,
        selectedCourseId,
        selectedLessonId,
        deleted: { kind: "course", courseId },
      });
      setSeries(next);
      setSelection(selection);
      if (targetSeries && targetCourse) {
        callContentApi("delete", {
          type: "course",
          series: targetSeries.name,
          name: targetCourse.name,
        }).catch((err: unknown) => onSaveError?.(`コース削除エラー: ${String(err)}`));
      }
    },
    [series, selectedCourseId, selectedLessonId, setSeries, setSelection, onSaveError],
  );

  const addCourse = useCallback(
    (seriesId: string, name: string) => {
      const targetSeries = series.find((s) => s.id === seriesId);
      const newId = `course-${seriesId}-${name}`;
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const newCourse: Course = {
            id: newId,
            name,
            target_audience: "",
            prerequisites: [],
            next_courses: [],
            lessons: [],
          };
          return { ...s, courses: [...s.courses, newCourse] };
        }),
      );
      if (targetSeries) {
        callContentApi("create", {
          type: "course",
          series: targetSeries.name,
          name,
        }).catch((err: unknown) => onSaveError?.(`コース追加エラー: ${String(err)}`));
      }
    },
    [series, setSeries, onSaveError],
  );

  const reorderSeries = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSeries((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        saveSeriesOrder(next.map((s) => s.name)).catch((err: unknown) => {
          onSaveError?.(`シリーズ順序保存エラー: ${String(err)}`);
        });
        return next;
      });
    },
    [setSeries, onSaveError],
  );

  const reorderCourses = useCallback(
    (seriesId: string, fromIndex: number, toIndex: number) => {
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const courses = [...s.courses];
          const [moved] = courses.splice(fromIndex, 1);
          courses.splice(toIndex, 0, moved);
          callContentApi("reorder", {
            type: "course",
            series: s.name,
            newOrder: courses.map((c) => c.name),
          }).catch((err: unknown) =>
            onSaveError?.(`コース並び替えエラー: ${String(err)}`),
          );
          return { ...s, courses };
        }),
      );
    },
    [setSeries, onSaveError],
  );

  const updateCourseMeta = useCallback(
    (
      courseId: string,
      meta: Pick<
        Course,
        "name" | "target_audience" | "prerequisites" | "next_courses"
      >,
    ) => {
      setSeries((prev) => {
        const crossPrerequisites = filterCrossSeriesIds(
          prev,
          courseId,
          meta.prerequisites ?? [],
        );
        const crossNextCourses = filterCrossSeriesIds(
          prev,
          courseId,
          meta.next_courses ?? [],
        );
        const synced = applyCrossSeriesCourseMetaEdit(
          prev,
          courseId,
          crossPrerequisites,
          crossNextCourses,
        );
        const next = synced.map((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c;
            const newName = meta.name?.trim() || c.name;
            const ctx = { seriesName: s.name, courseName: newName };
            return {
              ...c,
              name: newName,
              target_audience: meta.target_audience,
              lessons: c.lessons.map((l) =>
                reconcileLesson({ ...l, course: newName }, ctx),
              ),
            };
          }),
        }));
        for (const s of next) {
          const c = s.courses.find((co) => co.id === courseId);
          if (c) {
            saveCourseMeta(s.name, c.name, {
              target_audience: c.target_audience,
              prerequisites: c.prerequisites,
              next_courses: c.next_courses,
            }).catch((err: unknown) => {
              onSaveError?.(`コースメタ保存エラー: ${String(err)}`);
            });
            break;
          }
        }
        return next;
      });
    },
    [setSeries, onSaveError],
  );

  const updateSeriesName = useCallback(
    (seriesId: string, name: string) => {
      const target = series.find((s) => s.id === seriesId);
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const newName = name.trim() || s.name;
          return {
            ...s,
            name: newName,
            courses: s.courses.map((c) => ({
              ...c,
              lessons: c.lessons.map((l) =>
                reconcileLesson(
                  { ...l, series: newName },
                  { seriesName: newName, courseName: c.name },
                ),
              ),
            })),
          };
        }),
      );
      if (target) {
        const newName = name.trim() || target.name;
        if (newName !== target.name) {
          callContentApi("rename", {
            type: "series",
            oldName: target.name,
            newName,
          }).catch((err: unknown) =>
            onSaveError?.(`シリーズリネームエラー: ${String(err)}`),
          );
        }
      }
    },
    [series, setSeries, onSaveError],
  );

  return {
    addSeries,
    deleteSeries,
    addCourse,
    deleteCourse,
    reorderSeries,
    reorderCourses,
    updateCourseMeta,
    updateSeriesName,
  };
}
