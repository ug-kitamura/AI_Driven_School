"use client";

import { useCallback, useRef } from "react";
import type { Lesson, Series } from "@/lib/schema";
import {
  applyLessonContentEdit,
  createLessonContentTemplate,
  normalizeLessonMeta,
  patchLessonMeta,
  type LessonMetaFields,
} from "@/lib/lesson-frontmatter";

const AUTOSAVE_DEBOUNCE_MS = 800;

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

async function saveLessonToFs(
  series: string,
  course: string,
  lesson: string,
  content: string,
): Promise<void> {
  const res = await fetch("/api/content/save-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ series, course, lesson, content }),
  });
  if (!res.ok) {
    const { error } = (await res.json().catch(() => ({ error: "保存エラー" }))) as {
      error: string;
    };
    throw new Error(error);
  }
}

export function useLessonMutations(options: {
  setSeries: React.Dispatch<React.SetStateAction<Series[]>>;
  selectedLessonId: string;
  setSelectedLessonId: (lessonId: string) => void;
  onSaveError?: (msg: string) => void;
}) {
  const { setSeries, selectedLessonId, setSelectedLessonId, onSaveError } = options;
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
      let savedLesson: Lesson | null = null;
      mapLessonById(lessonId, (lesson, ctx) => {
        const updated = applyLessonContentEdit(lesson, ctx, content);
        savedLesson = updated;
        return updated;
      });

      if (!savedLesson) return;
      const { series, course, lesson } = savedLesson as Lesson;

      const existing = debounceTimers.current.get(lessonId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        debounceTimers.current.delete(lessonId);
        saveLessonToFs(series, course, lesson, content).catch((err: unknown) => {
          onSaveError?.(`レッスン保存エラー: ${String(err)}`);
        });
      }, AUTOSAVE_DEBOUNCE_MS);
      debounceTimers.current.set(lessonId, timer);
    },
    [mapLessonById, onSaveError],
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
      let seriesName = "";
      let courseName = "";
      const newId = `lesson-${Date.now()}`;
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c;
            seriesName = s.name;
            courseName = c.name;
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
      if (seriesName && courseName) {
        callContentApi("create", {
          type: "lesson",
          series: seriesName,
          course: courseName,
          name: lessonName,
        }).catch((err: unknown) => {
          onSaveError?.(`レッスン追加エラー: ${String(err)}`);
        });
      }
    },
    [setSeries, setSelectedLessonId, onSaveError],
  );

  const deleteLesson = useCallback(
    (courseId: string, lessonId: string) => {
      let seriesName = "";
      let courseName = "";
      let lessonName = "";
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c;
            const target = c.lessons.find((l) => l.id === lessonId);
            if (target) {
              seriesName = s.name;
              courseName = c.name;
              lessonName = target.lesson;
            }
            return { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) };
          }),
        })),
      );
      if (selectedLessonId === lessonId) setSelectedLessonId("");
      if (seriesName && courseName && lessonName) {
        callContentApi("delete", {
          type: "lesson",
          series: seriesName,
          course: courseName,
          name: lessonName,
        }).catch((err: unknown) => {
          onSaveError?.(`レッスン削除エラー: ${String(err)}`);
        });
      }
    },
    [setSeries, selectedLessonId, setSelectedLessonId, onSaveError],
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
            callContentApi("reorder", {
              type: "lesson",
              series: s.name,
              course: c.name,
              newOrder: lessons.map((l) => l.lesson),
            }).catch((err: unknown) => {
              onSaveError?.(`レッスン並び替えエラー: ${String(err)}`);
            });
            return { ...c, lessons };
          }),
        })),
      );
    },
    [setSeries, onSaveError],
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
