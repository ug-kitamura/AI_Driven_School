"use client";

import { useCallback } from "react";
import type { Lesson, Series } from "@/lib/schema";
import {
  applyLessonContentEdit,
  createLessonContentTemplate,
  normalizeLessonMeta,
  patchLessonMeta,
  type LessonMetaFields,
} from "@/lib/lesson-frontmatter";

export function useLessonMutations(options: {
  setSeries: React.Dispatch<React.SetStateAction<Series[]>>;
  selectedLessonId: string;
  setSelectedLessonId: (lessonId: string) => void;
}) {
  const { setSeries, selectedLessonId, setSelectedLessonId } = options;

  const mapLessonById = useCallback(
    (
      lessonId: string,
      fn: (
        lesson: Lesson,
        ctx: { seriesName: string; courseName: string },
      ) => Lesson,
    ) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => ({
            ...c,
            lessons: c.lessons.map((l) =>
              l.id === lessonId
                ? fn(l, { seriesName: s.name, courseName: c.name })
                : l,
            ),
          })),
        })),
      );
    },
    [setSeries],
  );

  const updateLessonContent = useCallback(
    (lessonId: string, content: string) => {
      mapLessonById(lessonId, (lesson, ctx) =>
        applyLessonContentEdit(lesson, ctx, content),
      );
    },
    [mapLessonById],
  );

  const updateLessonMeta = useCallback(
    (lessonId: string, meta: Partial<LessonMetaFields>) => {
      mapLessonById(lessonId, (lesson, ctx) => patchLessonMeta(lesson, ctx, meta));
    },
    [mapLessonById],
  );

  const updateLessonStatus = useCallback(
    (lessonId: string, status: Lesson["status"]) => {
      updateLessonMeta(lessonId, { status });
    },
    [updateLessonMeta],
  );

  const addLesson = useCallback(
    (courseId: string, lessonName: string) => {
      const newId = `lesson-${Date.now()}`;
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c;
            const meta = normalizeLessonMeta(
              {
                lesson: lessonName,
                status: "open",
                description: "",
                tags: [],
                estimated_minutes: 0,
                author: "",
              },
              { seriesName: s.name, courseName: c.name },
            );
            const newLesson: Lesson = {
              id: newId,
              ...meta,
              content: createLessonContentTemplate(meta),
            };
            return { ...c, lessons: [...c.lessons, newLesson] };
          }),
        })),
      );
      setSelectedLessonId(newId);
    },
    [setSeries, setSelectedLessonId],
  );

  const deleteLesson = useCallback(
    (courseId: string, lessonId: string) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) =>
            c.id === courseId
              ? { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) }
              : c,
          ),
        })),
      );
      if (selectedLessonId === lessonId) {
        setSelectedLessonId("");
      }
    },
    [setSeries, selectedLessonId, setSelectedLessonId],
  );

  const reorderLessons = useCallback(
    (courseId: string, fromIndex: number, toIndex: number) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c;
            const lessons = [...c.lessons];
            const [moved] = lessons.splice(fromIndex, 1);
            lessons.splice(toIndex, 0, moved);
            return { ...c, lessons };
          }),
        })),
      );
    },
    [setSeries],
  );

  return {
    addLesson,
    deleteLesson,
    reorderLessons,
    updateLessonContent,
    updateLessonMeta,
    updateLessonStatus,
  };
}
