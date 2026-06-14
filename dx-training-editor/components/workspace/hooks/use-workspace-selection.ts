"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Course, Lesson, Series } from "@/lib/schema";
import {
  resolveInitialSelection,
  saveStoredSelection,
  type WorkspaceSelection,
} from "@/lib/workspace-selection";

export function useWorkspaceSelection(options: {
  series: Series[];
  initialCourseId: string;
  initialLessonId: string;
}) {
  const { series, initialCourseId, initialLessonId } = options;
  const fallback = useMemo(
    (): WorkspaceSelection => ({
      courseId: initialCourseId,
      lessonId: initialLessonId,
    }),
    [initialCourseId, initialLessonId],
  );

  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
  const [selectedLessonId, setSelectedLessonId] = useState(initialLessonId);
  const skipPersistRef = useRef(true);

  useEffect(() => {
    const resolved = resolveInitialSelection(series, fallback);
    setSelectedCourseId(resolved.courseId);
    setSelectedLessonId(resolved.lessonId);
    skipPersistRef.current = false;
  }, [series, fallback]);

  useEffect(() => {
    if (skipPersistRef.current || !selectedCourseId) return;
    saveStoredSelection({
      courseId: selectedCourseId,
      lessonId: selectedLessonId,
    });
  }, [selectedCourseId, selectedLessonId]);

  const selectedCourse = useMemo((): Course | undefined => {
    for (const s of series) {
      const c = s.courses.find((c) => c.id === selectedCourseId);
      if (c) return c;
    }
    return undefined;
  }, [series, selectedCourseId]);

  const selectedLesson = useMemo((): Lesson | undefined => {
    return selectedCourse?.lessons.find((l) => l.id === selectedLessonId);
  }, [selectedCourse, selectedLessonId]);

  const selectedSeriesName = useMemo(() => {
    for (const s of series) {
      if (s.courses.some((c) => c.id === selectedCourseId)) return s.name;
    }
    return "";
  }, [series, selectedCourseId]);

  const setSelection = useCallback((selection: WorkspaceSelection) => {
    setSelectedCourseId(selection.courseId);
    setSelectedLessonId(selection.lessonId);
  }, []);

  const selectCourse = useCallback(
    (courseId: string) => {
      setSelectedCourseId(courseId);
      for (const s of series) {
        const c = s.courses.find((c) => c.id === courseId);
        if (c && c.lessons.length > 0) {
          setSelectedLessonId(c.lessons[0].id);
          return;
        }
      }
      setSelectedLessonId("");
    },
    [series],
  );

  const selectLesson = useCallback((lessonId: string) => {
    setSelectedLessonId(lessonId);
  }, []);

  return {
    selectedCourseId,
    selectedLessonId,
    selectedCourse,
    selectedLesson,
    selectedSeriesName,
    selectCourse,
    selectLesson,
    setSelection,
    setSelectedLessonId,
  };
}
