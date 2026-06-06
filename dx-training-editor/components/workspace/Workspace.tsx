"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { GlobalHeader } from "@/components/workspace/GlobalHeader";
import { SeriesCoursePane } from "@/components/workspace/SeriesCoursePane";
import { LessonListPane } from "@/components/workspace/LessonListPane";
import { MarkdownEditorPane } from "@/components/workspace/MarkdownEditorPane";
import { ImageManagerPane } from "@/components/workspace/ImageManagerPane";
import { PaneResizeHandle } from "@/components/workspace/PaneResizeHandle";
import { ThemeInitializer } from "@/components/workspace/ThemeInitializer";
import { WorkspaceSettingsDialog } from "@/components/workspace/WorkspaceSettingsDialog";
import { useWorkspacePaneWidths } from "@/components/workspace/use-workspace-pane-widths";
import type { Series, Course, Lesson } from "@/lib/schema";
import {
  applyCourseDeletion,
  applyCrossSeriesCourseMetaEdit,
  applySeriesDeletion,
  filterCrossSeriesIds,
  normalizeSeriesCourseMeta,
} from "@/lib/course-flow";
import {
  createLessonContentTemplate,
  normalizeAllLessonsInSeries,
  normalizeLessonMeta,
  applyLessonContentEdit,
  patchLessonMeta,
  reconcileLesson,
  type LessonMetaFields,
} from "@/lib/lesson-frontmatter";
import { collectAllLessonTags } from "@/lib/lesson-tags";
import { fetchAvailableImagePaths } from "@/lib/preview-image-assets";
import { normalizeImageLogicalPath } from "@/lib/image-path";
import { htmlCommentInnerTextAtOffset } from "@/lib/html-comment-at-cursor";

export type Pane3Mode = "inline" | "raw" | "diff";

function Pane1ResizeHandle({
  className,
  style,
  ...props
}: React.ComponentProps<typeof PaneResizeHandle>) {
  const { state } = useSidebar();
  if (state !== "expanded") return null;
  return (
    <PaneResizeHandle
      className={className}
      style={style}
      lineClassName="w-px origin-center scale-x-[0.35] bg-border/40 hover:bg-primary/25 active:bg-primary/40"
      {...props}
    />
  );
}

type WorkspaceProps = {
  initialSeries: Series[];
  workspace: { name: string; icon: string };
};

export function Workspace({
  initialSeries,
  workspace,
}: WorkspaceProps) {
  const [series, setSeries] = useState<Series[]>(() =>
    normalizeAllLessonsInSeries(normalizeSeriesCourseMeta(initialSeries)),
  );
  const [pane4ManuallyClosed, setPane4ManuallyClosed] = useState(false);
  const [pane3Mode, setPane3Mode] = useState<Pane3Mode>("raw");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorCommentPrompt, setEditorCommentPrompt] = useState<string | null>(
    null,
  );
  const [editorCursorOffset, setEditorCursorOffset] = useState<number | null>(
    null,
  );
  const [imageAssetsRevision, setImageAssetsRevision] = useState(0);
  const [availableImagePaths, setAvailableImagePaths] = useState<Set<string> | null>(
    null,
  );
  const { paneWidths, isResizing, resizeHandleProps, applyPaneWidths } =
    useWorkspacePaneWidths();

  // 最初のコースを初期選択
  const firstCourseId = initialSeries[0]?.courses[0]?.id ?? "";
  const firstLessonId = initialSeries[0]?.courses[0]?.lessons[0]?.id ?? "";
  const [selectedCourseId, setSelectedCourseId] = useState<string>(firstCourseId);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(firstLessonId);

  // カーソル挿入位置（Pane3 の textarea ref から Pane4 が使う）
  const [insertCallback, setInsertCallback] = useState<
    ((markdown: string) => void) | null
  >(null);

  // 派生: 選択中コース・レッスン
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

  const tagSuggestions = useMemo(
    () => collectAllLessonTags(series),
    [series],
  );

  const notifyImageAssetsChanged = useCallback(
    (removedPaths?: string | string[]) => {
      if (removedPaths) {
        const list = Array.isArray(removedPaths) ? removedPaths : [removedPaths];
        setAvailableImagePaths((prev) => {
          if (!prev) return prev;
          const next = new Set(prev);
          for (const path of list) {
            next.delete(normalizeImageLogicalPath(path));
          }
          return next;
        });
      }
      setImageAssetsRevision((v) => v + 1);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchAvailableImagePaths().then((paths) => {
      if (!cancelled) setAvailableImagePaths(paths);
    });
    return () => {
      cancelled = true;
    };
  }, [imageAssetsRevision]);

  // コース選択（Pane1 から、またはPane2の前提/次コースクリック）
  const selectCourse = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
    // そのコースの最初のレッスンを自動選択
    for (const s of series) {
      const c = s.courses.find((c) => c.id === courseId);
      if (c && c.lessons.length > 0) {
        setSelectedLessonId(c.lessons[0].id);
        return;
      }
    }
    setSelectedLessonId("");
  }, [series]);

  // レッスン選択（Pane2 から）
  const selectLesson = useCallback((lessonId: string) => {
    setSelectedLessonId(lessonId);
  }, []);

  const mapLessonById = useCallback(
    (lessonId: string, fn: (lesson: Lesson, ctx: { seriesName: string; courseName: string }) => Lesson) => {
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
    [],
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
      mapLessonById(lessonId, (lesson, ctx) =>
        patchLessonMeta(lesson, ctx, meta),
      );
    },
    [mapLessonById],
  );

  const updateLessonStatus = useCallback(
    (lessonId: string, status: Lesson["status"]) => {
      updateLessonMeta(lessonId, { status });
    },
    [updateLessonMeta],
  );

  // レッスン追加（Pane2 から）
  const addLesson = useCallback((courseId: string, lessonName: string) => {
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
  }, []);

  // レッスン削除（Pane2 から）
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
      if (selectedLessonId === lessonId) setSelectedLessonId("");
    },
    [selectedLessonId],
  );

  // シリーズ追加（Pane1 から）
  const addSeries = useCallback((name: string) => {
    const newId = `series-${Date.now()}`;
    setSeries((prev) => [
      ...prev,
      { id: newId, name, courses: [] },
    ]);
    return newId;
  }, []);

  // シリーズ削除（Pane1 から・コースがある場合は UI 側でブロック）
  const deleteSeries = useCallback(
    (seriesId: string) => {
      setSeries((prev) => {
        const next = applySeriesDeletion(prev, seriesId);
        const removed = prev.find((s) => s.id === seriesId);
        const hadSelectedCourse =
          removed?.courses.some((c) => c.id === selectedCourseId) ?? false;
        if (hadSelectedCourse) {
          const firstCourse = next.flatMap((s) => s.courses)[0];
          setSelectedCourseId(firstCourse?.id ?? "");
          setSelectedLessonId(firstCourse?.lessons[0]?.id ?? "");
        }
        return next;
      });
    },
    [selectedCourseId],
  );

  // コース削除（Pane1 から・レッスンがある場合は UI 側でブロック）
  const deleteCourse = useCallback(
    (seriesId: string, courseId: string) => {
      setSeries((prev) => {
        const next = applyCourseDeletion(prev, seriesId, courseId);
        if (selectedCourseId === courseId) {
          const firstCourse = next.flatMap((s) => s.courses)[0];
          setSelectedCourseId(firstCourse?.id ?? "");
          setSelectedLessonId(firstCourse?.lessons[0]?.id ?? "");
        }
        return next;
      });
    },
    [selectedCourseId],
  );

  // コース追加（Pane1 から）
  const addCourse = useCallback((seriesId: string, name: string) => {
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
  }, []);

  // シリーズ並び替え（Pane1 DnD から）
  const reorderSeries = useCallback((fromIndex: number, toIndex: number) => {
    setSeries((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  // コース並び替え（Pane1 DnD から）同シリーズ内のみ
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
    [],
  );

  // レッスン並び替え（Pane2 DnD から）
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
    [],
  );

  // コースメタ情報更新（Pane2 の編集ダイアログから）
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
    [],
  );

  const updateSeriesName = useCallback((seriesId: string, name: string) => {
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
  }, []);

  // 画像挿入コールバック登録（Pane3 → Pane4 の橋渡し）
  const registerInsertCallback = useCallback(
    (cb: (markdown: string) => void) => {
      setInsertCallback(() => cb);
    },
    [],
  );

  const insertImageMarkdown = useCallback(
    (markdown: string): boolean => {
      if (pane3Mode !== "raw") return false;
      if (!insertCallback) return false;
      insertCallback(markdown);
      return true;
    },
    [pane3Mode, insertCallback],
  );

  const handleEditorCursorChange = useCallback(
    (offset: number) => {
      if (pane3Mode !== "raw" || !selectedLesson) {
        setEditorCommentPrompt(null);
        setEditorCursorOffset(null);
        return;
      }
      setEditorCursorOffset(offset);
      setEditorCommentPrompt(
        htmlCommentInnerTextAtOffset(selectedLesson.content, offset),
      );
    },
    [pane3Mode, selectedLesson],
  );

  useEffect(() => {
    if (pane3Mode !== "raw" || !selectedLesson) {
      setEditorCommentPrompt(null);
      setEditorCursorOffset(null);
    }
  }, [pane3Mode, selectedLesson?.id]);

  const selectedSeriesName = useMemo(() => {
    for (const s of series) {
      if (s.courses.some((c) => c.id === selectedCourseId)) return s.name;
    }
    return "";
  }, [series, selectedCourseId]);

  const pane4Open = !pane4ManuallyClosed;

  return (
    <SidebarProvider
      defaultOpen
      data-resizing={isResizing ? "" : undefined}
      className={cn(
        "h-screen w-full overflow-hidden bg-background text-foreground",
        isResizing &&
          "[&_[data-slot=sidebar-gap]]:transition-none [&_[data-slot=sidebar-container]]:transition-none",
      )}
      style={
        {
          "--sidebar-width": `${paneWidths.pane1}px`,
        } as React.CSSProperties
      }
    >
      <ThemeInitializer />
      <div className="relative shrink-0">
        <SeriesCoursePane
          workspaceName={workspace.name}
          series={series}
          selectedCourseId={selectedCourseId}
          onSelectCourse={selectCourse}
          onReorderSeries={reorderSeries}
          onReorderCourses={reorderCourses}
          onAddSeries={addSeries}
          onAddCourse={addCourse}
          onDeleteSeries={deleteSeries}
          onDeleteCourse={deleteCourse}
          onUpdateSeriesName={updateSeriesName}
        />
        <Pane1ResizeHandle
          {...resizeHandleProps("pane1")}
          className="absolute inset-y-0 z-30 mx-0 px-2"
          style={{ left: "calc(var(--sidebar-width) - 8px)" }}
        />
      </div>
      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <GlobalHeader
          departmentTitle={selectedSeriesName}
          positionTitle={selectedCourse?.name ?? ""}
          candidateName={selectedLesson?.lesson ?? ""}
          series={series}
          selectedCourseId={selectedCourseId}
          onSelectCourse={selectCourse}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <WorkspaceSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          currentPaneWidths={paneWidths}
          onApplyPaneWidths={applyPaneWidths}
        />
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            className="flex h-full min-w-0 shrink-0 flex-col overflow-hidden"
            style={{ width: paneWidths.pane2 }}
          >
            <LessonListPane
              series={series}
              course={selectedCourse}
              selectedLessonId={selectedLessonId}
              onSelectLesson={selectLesson}
              onSelectCourse={selectCourse}
              onAddLesson={addLesson}
              onDeleteLesson={deleteLesson}
              onReorderLessons={reorderLessons}
              onUpdateCourseMeta={updateCourseMeta}
              onUpdateLessonStatus={updateLessonStatus}
            />
          </div>
          <PaneResizeHandle {...resizeHandleProps("pane2")} />
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <MarkdownEditorPane
              lesson={selectedLesson}
              mode={pane3Mode}
              onModeChange={setPane3Mode}
              onUpdateContent={updateLessonContent}
              onUpdateLessonMeta={updateLessonMeta}
              onRegisterInsertCallback={registerInsertCallback}
              onEditorCursorChange={handleEditorCursorChange}
              tagSuggestions={tagSuggestions}
              availableImagePaths={availableImagePaths}
              imageAssetsRevision={imageAssetsRevision}
            />
          </div>
          {pane4Open ? (
            <>
              <PaneResizeHandle {...resizeHandleProps("pane4")} />
              <div
                className="flex h-full shrink-0 flex-col overflow-hidden"
                style={{ width: paneWidths.pane4 }}
              >
                <ImageManagerPane
                  series={series}
                  lesson={selectedLesson}
                  pane3Mode={pane3Mode}
                  onInsertImage={insertImageMarkdown}
                  editorCommentPrompt={editorCommentPrompt}
                  editorCursorOffset={editorCursorOffset}
                  pane4Open={pane4Open}
                  onTogglePane4={() => setPane4ManuallyClosed((v) => !v)}
                  onImageAssetsChanged={notifyImageAssetsChanged}
                />
              </div>
            </>
          ) : (
            <ImageManagerPane
              series={series}
              lesson={selectedLesson}
              pane3Mode={pane3Mode}
              onInsertImage={insertImageMarkdown}
              editorCommentPrompt={editorCommentPrompt}
              editorCursorOffset={editorCursorOffset}
              pane4Open={pane4Open}
              onTogglePane4={() => setPane4ManuallyClosed((v) => !v)}
              onImageAssetsChanged={notifyImageAssetsChanged}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
