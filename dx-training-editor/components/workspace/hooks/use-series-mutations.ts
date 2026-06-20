"use client";

import { useCallback } from "react";
import type { Course, Series } from "@/lib/schema";

async function saveCourseMeta(
  seriesSlug: string,
  courseSlug: string,
  meta: Pick<Course, "target_audience" | "prerequisites" | "next_courses">,
): Promise<void> {
  const res = await fetch("/api/content/save-course", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      series: seriesSlug,
      course: courseSlug,
      target_audience: meta.target_audience ?? "",
      prerequisites: meta.prerequisites,
      next_courses: meta.next_courses,
    }),
  });
  if (!res.ok) throw new Error("コースメタ保存エラー");
}

async function saveSeriesOrder(seriesSlugs: string[]): Promise<void> {
  const res = await fetch("/api/content/save-series-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order: seriesSlugs }),
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
  applySeriesRename,
  remapCourseAndLessonIds,
  remapSelection,
} from "@/lib/content-rename";
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
    (titleJa: string, slug: string) => {
      const newId = `series-${slug}`;
      setSeries((prev) => [
        ...prev,
        { id: newId, slug, name: titleJa, titleEn: null, courses: [] },
      ]);
      callContentApi("create", { type: "series", slug, titleJa }).catch((err: unknown) => {
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
        const slug = target.slug ?? target.name;
        callContentApi("delete", { type: "series", slug }).catch(
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
        const seriesSlug = targetSeries.slug ?? targetSeries.name;
        const courseSlug = targetCourse.slug ?? targetCourse.name;
        callContentApi("delete", {
          type: "course",
          series: seriesSlug,
          slug: courseSlug,
        }).catch((err: unknown) => onSaveError?.(`コース削除エラー: ${String(err)}`));
      }
    },
    [series, selectedCourseId, selectedLessonId, setSeries, setSelection, onSaveError],
  );

  const addCourse = useCallback(
    (seriesId: string, titleJa: string, slug: string) => {
      const targetSeries = series.find((s) => s.id === seriesId);
      const newId = `course-${targetSeries?.slug ?? seriesId}-${slug}`;
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const newCourse: Course = {
            id: newId,
            slug,
            name: titleJa,
            titleEn: null,
            target_audience: "",
            prerequisites: [],
            next_courses: [],
            lessons: [],
          };
          return { ...s, courses: [...s.courses, newCourse] };
        }),
      );
      if (targetSeries) {
        const seriesSlug = targetSeries.slug ?? targetSeries.name;
        callContentApi("create", {
          type: "course",
          series: seriesSlug,
          slug,
          titleJa,
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
        saveSeriesOrder(next.map((s) => s.slug ?? s.name)).catch((err: unknown) => {
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
          const seriesSlug = s.slug ?? s.name;
          callContentApi("reorder", {
            type: "course",
            series: seriesSlug,
            newOrder: courses.map((c) => c.slug ?? c.name),
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
      let seriesName: string | undefined;
      let seriesSlug: string | undefined;
      let courseSlug: string | undefined;
      for (const s of series) {
        const c = s.courses.find((co) => co.id === courseId);
        if (c) {
          seriesName = s.name;
          seriesSlug = s.slug ?? s.name;
          courseSlug = c.slug ?? c.name;
          break;
        }
      }
      if (!seriesName || !seriesSlug) return;

      const crossPrerequisites = filterCrossSeriesIds(
        series,
        courseId,
        meta.prerequisites ?? [],
      );
      const crossNextCourses = filterCrossSeriesIds(
        series,
        courseId,
        meta.next_courses ?? [],
      );
      const synced = applyCrossSeriesCourseMetaEdit(
        series,
        courseId,
        crossPrerequisites,
        crossNextCourses,
      );
      const next = synced.map((s) => ({
        ...s,
        courses: s.courses.map((c) => {
          if (c.id !== courseId) return c;
          return {
            ...c,
            name: meta.name?.trim() || c.name,
            target_audience: meta.target_audience,
            lessons: c.lessons.map((l) =>
              reconcileLesson({ ...l, course: c.slug ?? c.name }, {
                seriesName: s.slug ?? s.name,
                courseName: c.slug ?? c.name,
              }),
            ),
          };
        }),
      }));

      setSeries(next);

      const updatedCourse = next
        .flatMap((s) => s.courses)
        .find((c) => c.id === courseId);
      if (!updatedCourse || !courseSlug) return;

      const metaPayload = {
        target_audience: updatedCourse.target_audience,
        prerequisites: updatedCourse.prerequisites,
        next_courses: updatedCourse.next_courses,
      };

      // タイトル変更は _meta.json の title.ja 更新のみ（slug は変更しない）
      const titleChanged = meta.name?.trim() && meta.name.trim() !== updatedCourse.name;
      if (titleChanged) {
        callContentApi("rename", {
          type: "course",
          series: seriesSlug,
          slug: courseSlug,
          newTitleJa: meta.name!.trim(),
        }).catch((err: unknown) =>
          onSaveError?.(`コースタイトル更新エラー: ${String(err)}`),
        );
      }

      saveCourseMeta(seriesSlug, courseSlug, metaPayload).catch(
        (err: unknown) => {
          onSaveError?.(`コースメタ保存エラー: ${String(err)}`);
        },
      );
    },
    [series, setSeries, onSaveError],
  );

  const updateSeriesName = useCallback(
    (seriesId: string, name: string) => {
      const target = series.find((s) => s.id === seriesId);
      if (!target) return;
      const newName = name.trim() || target.name;
      if (newName === target.name) return;

      // state 内の表示名を更新（slug・id は変更しない）
      setSeries((prev) =>
        prev.map((s) => (s.id === seriesId ? { ...s, name: newName } : s)),
      );

      const slug = target.slug ?? target.name;
      callContentApi("rename", {
        type: "series",
        slug,
        newTitleJa: newName,
      }).catch((err: unknown) =>
        onSaveError?.(`シリーズタイトル更新エラー: ${String(err)}`),
      );
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
