"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Series } from "@/lib/schema";
import {
  normalizeAllLessonsInSeries,
} from "@/lib/lesson-frontmatter";
import { normalizeSeriesCourseMeta } from "@/lib/course-flow";

const POLL_INTERVAL_MS = 3000;

export function useContentSync(options: {
  /** 現在の series state（編集中レッスン content を保護するために使用） */
  series: Series[];
  selectedLessonId: string;
  onSeriesLoaded: (newSeries: Series[]) => void;
}) {
  const { series, selectedLessonId, onSeriesLoaded } = options;

  const lastMtimeRef = useRef<number>(0);
  const seriesRef = useRef(series);
  const selectedLessonIdRef = useRef(selectedLessonId);
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  useEffect(() => {
    selectedLessonIdRef.current = selectedLessonId;
  }, [selectedLessonId]);

  /** pendingSave フラグを立てる（debounce timer 開始時に呼ぶ） */
  const setPendingSave = useCallback((pending: boolean) => {
    pendingSaveRef.current = pending;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchAndMerge() {
      if (pendingSaveRef.current) return;

      try {
        const [mtimeRes] = await Promise.all([
          fetch("/api/content/mtime", { cache: "no-store" }),
        ]);
        if (!mtimeRes.ok || cancelled) return;
        const { mtime } = (await mtimeRes.json()) as { mtime: number };

        if (lastMtimeRef.current === 0) {
          lastMtimeRef.current = mtime;
          return;
        }
        if (mtime <= lastMtimeRef.current) return;
        lastMtimeRef.current = mtime;

        const dataRes = await fetch("/api/content/load", { cache: "no-store" });
        if (!dataRes.ok || cancelled) return;
        const freshSeries = (await dataRes.json()) as Series[];

        // 編集中レッスンの content だけ保護してマージ
        const currentLessonId = selectedLessonIdRef.current;
        const currentLesson = currentLessonId
          ? findLessonById(seriesRef.current, currentLessonId)
          : null;

        const merged = normalizeAllLessonsInSeries(
          normalizeSeriesCourseMeta(freshSeries),
        ).map((s) => ({
          ...s,
          courses: s.courses.map((c) => ({
            ...c,
            lessons: c.lessons.map((l) => {
              if (currentLesson && l.id === currentLessonId) {
                return { ...l, content: currentLesson.content };
              }
              return l;
            }),
          })),
        }));

        onSeriesLoaded(merged);
      } catch {
        /* ネットワークエラーは無視 */
      }
    }

    const timer = setInterval(() => {
      void fetchAndMerge();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onSeriesLoaded]);

  return { setPendingSave };
}

function findLessonById(series: Series[], lessonId: string) {
  for (const s of series) {
    for (const c of s.courses) {
      for (const l of c.lessons) {
        if (l.id === lessonId) return l;
      }
    }
  }
  return null;
}
