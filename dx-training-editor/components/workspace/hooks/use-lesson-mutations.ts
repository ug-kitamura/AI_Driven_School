"use client";

import { useCallback, useRef } from "react";
import type { Lesson, Series } from "@/lib/schema";
import {
  applyLessonContentEdit,
  createLessonContentTemplate,
  normalizeLessonMeta,
  parseLessonDocument,
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
  series: Series[];
  setSeries: React.Dispatch<React.SetStateAction<Series[]>>;
  selectedLessonId: string;
  setSelectedLessonId: (lessonId: string) => void;
  onSaveError?: (msg: string) => void;
}) {
  const { series, setSeries, selectedLessonId, setSelectedLessonId, onSaveError } = options;
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /**
   * エディタでフロントマターの lesson 名を直接変更した場合に使う。
   * デバウンスがリセットされても "変更前のディスク上のファイル名" を保持する。
   */
  const pendingRename = useRef<{
    series: string;
    course: string;
    oldName: string;
  } | null>(null);

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

      const diskLessonName = diskLesson.lesson; // ディスク上のファイル名（編集前）

      // フロントマターから新しいレッスン名を取得
      const { meta } = parseLessonDocument(content);
      const newLessonName = meta.lesson?.trim() || diskLessonName;
      const nameChanged = newLessonName !== diskLessonName;

      // state を更新（lesson.lesson が frontmatter に追従する）
      mapLessonById(lessonId, (lesson, ctx) => applyLessonContentEdit(lesson, ctx, content));

      if (nameChanged) {
        // pendingRename は最初の名前変更時のみセット（連続入力でも上書きしない）
        if (!pendingRename.current) {
          pendingRename.current = { series: seriesName, course: courseName, oldName: diskLessonName };
        }
        // lessonId を新名ベースに即座に更新
        const newId = `lesson-${seriesName}-${courseName}-${newLessonName}`;
        setSeries((prev) =>
          prev.map((s) => ({
            ...s,
            courses: s.courses.map((c) => ({
              ...c,
              lessons: c.lessons.map((l) => (l.id === lessonId ? { ...l, id: newId } : l)),
            })),
          })),
        );
        setSelectedLessonId(newId);
      }

      // デバウンスキーは元の lessonId（変更前）で管理する
      const existing = debounceTimers.current.get(lessonId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        debounceTimers.current.delete(lessonId);

        const rename = pendingRename.current;
        if (rename) {
          // フロントマターから最終的な新名を再取得して確実にする
          const { meta: latestMeta } = parseLessonDocument(content);
          const latestNewName = latestMeta.lesson?.trim() || rename.oldName;
          pendingRename.current = null;

          if (rename.oldName !== latestNewName) {
            callContentApi("rename", {
              type: "lesson",
              series: rename.series,
              course: rename.course,
              oldName: rename.oldName,
              newName: latestNewName,
            })
              .then(() => saveLessonToFs(rename.series, rename.course, latestNewName, content))
              .catch((err: unknown) => {
                onSaveError?.(`レッスンリネームエラー: ${String(err)}`);
              });
          } else {
            // 元の名前に戻った場合は通常保存
            saveLessonToFs(rename.series, rename.course, rename.oldName, content).catch(
              (err: unknown) => {
                onSaveError?.(`レッスン保存エラー: ${String(err)}`);
              },
            );
          }
        } else {
          // 通常保存（ファイル名はディスク上の名前のまま）
          saveLessonToFs(seriesName, courseName, diskLessonName, content).catch((err: unknown) => {
            onSaveError?.(`レッスン保存エラー: ${String(err)}`);
          });
        }
      }, AUTOSAVE_DEBOUNCE_MS);

      debounceTimers.current.set(lessonId, timer);
    },
    [series, mapLessonById, setSeries, setSelectedLessonId, onSaveError],
  );

  const updateLessonMeta = useCallback(
    (lessonId: string, meta: Partial<LessonMetaFields>) => {
      let oldLessonName = "";
      let newLessonName = "";
      let seriesName = "";
      let courseName = "";

      mapLessonById(lessonId, (lesson, ctx) => {
        const updated = patchLessonMeta(lesson, ctx, meta);
        if (meta.lesson !== undefined && lesson.lesson !== meta.lesson) {
          oldLessonName = lesson.lesson;
          newLessonName = updated.lesson;
          seriesName = updated.series;
          courseName = updated.course;
        }
        return updated;
      });

      if (oldLessonName && newLessonName && oldLessonName !== newLessonName) {
        const newId = `lesson-${seriesName}-${courseName}-${newLessonName}`;

        // state のレッスン ID を新しい名前ベースの ID に差し替える
        setSeries((prev) =>
          prev.map((s) => ({
            ...s,
            courses: s.courses.map((c) => ({
              ...c,
              lessons: c.lessons.map((l) =>
                l.id === lessonId ? { ...l, id: newId } : l,
              ),
            })),
          })),
        );
        setSelectedLessonId(newId);

        callContentApi("rename", {
          type: "lesson",
          series: seriesName,
          course: courseName,
          oldName: oldLessonName,
          newName: newLessonName,
        }).catch((err: unknown) => {
          onSaveError?.(`レッスンリネームエラー: ${String(err)}`);
        });
      }
    },
    [mapLessonById, setSeries, setSelectedLessonId, onSaveError],
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
