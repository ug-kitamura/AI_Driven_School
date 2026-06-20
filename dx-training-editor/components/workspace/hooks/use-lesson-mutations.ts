"use client";

import { useCallback, useRef } from "react";
import type { Lesson, Series } from "@/lib/schema";
import { buildLessonId } from "@/lib/content-ids";
import { remapSelection } from "@/lib/content-rename";
import {
  applyLessonContentEdit,
  alignLessonContentToDiskPath,
  createLessonContentTemplate,
  lessonFileContentEquals,
  normalizeLessonMeta,
  patchLessonMeta,
  type LessonMetaFields,
} from "@/lib/lesson-frontmatter";
import type { WorkspaceSelection } from "@/lib/workspace-selection";

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
  series: Series[];
  setSeries: React.Dispatch<React.SetStateAction<Series[]>>;
  selectedCourseId: string;
  selectedLessonId: string;
  setSelection: (selection: WorkspaceSelection) => void;
  setPendingSave?: (pending: boolean) => void;
  onSaveError?: (msg: string) => void;
}) {
  const {
    series,
    setSeries,
    selectedCourseId,
    selectedLessonId,
    setSelection,
    setPendingSave,
    onSaveError,
  } = options;
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
      // series state を同期的に走査して現在のレッスン情報を取得する
      // （setSeries の更新関数は遅延評価のため、ここで直接読む）
      let diskLesson: Lesson | null = null;
      let seriesName = "";
      let courseName = "";
      for (const s of series) {
        for (const c of s.courses) {
          for (const l of c.lessons) {
            if (l.id === lessonId) {
              diskLesson = l;
              seriesName = s.name;
              courseName = c.name;
            }
          }
        }
      }
      if (!diskLesson) return;

      const diskLessonName = diskLesson.lesson;
      const ctx = { seriesName, courseName };
      const aligned = alignLessonContentToDiskPath(content, ctx, diskLessonName);
      if (!aligned.ok) {
        onSaveError?.(
          `保存をスキップしました: ${aligned.reason}。別レッスンの内容が混ざっている可能性があります。`,
        );
        return;
      }
      content = aligned.content;

      if (lessonFileContentEquals(content, diskLesson.content)) return;

      mapLessonById(lessonId, (lesson, mapCtx) =>
        applyLessonContentEdit(lesson, mapCtx, content),
      );

      const existing = debounceTimers.current.get(lessonId);
      if (existing) clearTimeout(existing);

      setPendingSave?.(true);

      const timer = setTimeout(() => {
        debounceTimers.current.delete(lessonId);
        saveLessonToFs(seriesName, courseName, diskLessonName, content)
          .catch((err: unknown) => {
            onSaveError?.(`レッスン保存エラー: ${String(err)}`);
          })
          .finally(() => {
            setPendingSave?.(false);
          });
      }, AUTOSAVE_DEBOUNCE_MS);

      debounceTimers.current.set(lessonId, timer);
    },
    [series, mapLessonById, setPendingSave, onSaveError],
  );

  const updateLessonMeta = useCallback(
    (lessonId: string, meta: Partial<LessonMetaFields>) => {
      let rename: {
        oldName: string;
        newName: string;
        series: string;
        course: string;
        newId: string;
      } | null = null;
      let updatedLesson: Lesson | null = null;

      const next = series.map((s) => ({
        ...s,
        courses: s.courses.map((c) => ({
          ...c,
          lessons: c.lessons.map((l) => {
            if (l.id !== lessonId) return l;
            const ctx = { seriesName: s.name, courseName: c.name };
            const updated = patchLessonMeta(l, ctx, meta);
            if (meta.lesson !== undefined && l.lesson !== updated.lesson) {
              const newId = buildLessonId(
                updated.series,
                updated.course,
                updated.lesson,
              );
              rename = {
                oldName: l.lesson,
                newName: updated.lesson,
                series: updated.series,
                course: updated.course,
                newId,
              };
              updatedLesson = { ...updated, id: newId };
              return updatedLesson;
            }
            updatedLesson = updated;
            return updated;
          }),
        })),
      }));

      if (!updatedLesson) return;

      setSeries(next);

      const persistMeta = () =>
        saveLessonToFs(
          updatedLesson!.series,
          updatedLesson!.course,
          updatedLesson!.lesson,
          updatedLesson!.content,
        ).catch((err: unknown) => {
          onSaveError?.(`レッスン保存エラー: ${String(err)}`);
        });

      if (rename) {
        const { oldName, newName, series: seriesName, course: courseName, newId } =
          rename;
        setSelection(
          remapSelection(
            { courseId: selectedCourseId, lessonId },
            { courseIds: new Map(), lessonIds: new Map([[lessonId, newId]]) },
          ),
        );
        callContentApi("rename", {
          type: "lesson",
          series: seriesName,
          course: courseName,
          oldName,
          newName,
        })
          .then(persistMeta)
          .catch((err: unknown) => {
            onSaveError?.(`レッスンリネームエラー: ${String(err)}`);
          });
      } else {
        persistMeta();
      }
    },
    [series, selectedCourseId, setSeries, setSelection, onSaveError],
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
      for (const s of series) {
        const c = s.courses.find((co) => co.id === courseId);
        if (c) {
          seriesName = s.name;
          courseName = c.name;
          break;
        }
      }
      if (!seriesName || !courseName) return;

      const meta = normalizeLessonMeta(
        {
          lesson: lessonName,
          status: "open",
          description: "",
          tags: [],
          estimated_minutes: 0,
          author: "",
        },
        { seriesName, courseName },
      );
      const newLesson: Lesson = {
        id: buildLessonId(seriesName, courseName, lessonName),
        ...meta,
        content: createLessonContentTemplate(meta),
      };

      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) =>
            c.id === courseId
              ? { ...c, lessons: [...c.lessons, newLesson] }
              : c,
          ),
        })),
      );
      setSelection({ courseId, lessonId: newLesson.id });
      setPendingSave?.(true);
      saveLessonToFs(
        seriesName,
        courseName,
        newLesson.lesson,
        newLesson.content,
      )
        .catch((err: unknown) => {
          onSaveError?.(`レッスン追加エラー: ${String(err)}`);
        })
        .finally(() => {
          setPendingSave?.(false);
        });
    },
    [series, setSeries, setSelection, setPendingSave, onSaveError],
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
      if (selectedLessonId === lessonId) {
        setSelection({ courseId: selectedCourseId, lessonId: "" });
      }
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
    [setSeries, selectedCourseId, selectedLessonId, setSelection, onSaveError],
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
