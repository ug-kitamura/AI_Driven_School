"use client";

import { useCallback } from "react";
import type { Course, Series } from "@/lib/schema";
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
}) {
  const { series, setSeries, selectedCourseId, selectedLessonId, setSelection } =
    options;

  const addSeries = useCallback(
    (name: string) => {
      const newId = `series-${Date.now()}`;
      setSeries((prev) => [...prev, { id: newId, name, courses: [] }]);
      return newId;
    },
    [setSeries],
  );

  const deleteSeries = useCallback(
    (seriesId: string) => {
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
    },
    [series, selectedCourseId, selectedLessonId, setSeries, setSelection],
  );

  const deleteCourse = useCallback(
    (seriesId: string, courseId: string) => {
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
    },
    [series, selectedCourseId, selectedLessonId, setSeries, setSelection],
  );

  const addCourse = useCallback(
    (seriesId: string, name: string) => {
      const newId = `course-${Date.now()}`;
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
    },
    [setSeries],
  );

  const reorderSeries = useCallback(
    (fromIndex: number, toIndex: number) => {
      setSeries((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [setSeries],
  );

  const reorderCourses = useCallback(
    (seriesId: string, fromIndex: number, toIndex: number) => {
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const courses = [...s.courses];
          const [moved] = courses.splice(fromIndex, 1);
          courses.splice(toIndex, 0, moved);
          return { ...s, courses };
        }),
      );
    },
    [setSeries],
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
        return synced.map((s) => ({
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
      });
    },
    [setSeries],
  );

  const updateSeriesName = useCallback(
    (seriesId: string, name: string) => {
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
    },
    [setSeries],
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
