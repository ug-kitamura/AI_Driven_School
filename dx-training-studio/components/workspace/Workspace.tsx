"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { WorkScope } from "@/lib/work-scope";
import { GlobalHeader } from "@/components/workspace/GlobalHeader";
import { SeriesCoursePane } from "@/components/workspace/SeriesCoursePane";
import { LessonListPane } from "@/components/workspace/LessonListPane";
import { MarkdownEditorPane } from "@/components/workspace/MarkdownEditorPane";
import { Pane4Shell } from "@/components/workspace/Pane4Shell";
import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";
import { PaneResizeHandle } from "@/components/workspace/PaneResizeHandle";
import { PANE4_COLLAPSED_WIDTH } from "@/components/workspace/pane-layout";
import { ThemeInitializer } from "@/components/workspace/ThemeInitializer";
import { CompanyContextDialog } from "@/components/workspace/CompanyContextDialog";
import { WorkspaceSettingsDialog } from "@/components/workspace/WorkspaceSettingsDialog";
import { PANE3_MIN_WIDTH } from "@/components/workspace/pane-layout";
import { useWorkspacePaneWidths } from "@/components/workspace/use-workspace-pane-widths";
import { useLessonMutations } from "@/components/workspace/hooks/use-lesson-mutations";
import { useSeriesMutations } from "@/components/workspace/hooks/use-series-mutations";
import { useWorkspaceImageAssets } from "@/components/workspace/hooks/use-workspace-image-assets";
import { useWorkspaceSelection } from "@/components/workspace/hooks/use-workspace-selection";
import { useContentSync } from "@/components/workspace/hooks/use-content-sync";
import type { Series } from "@/lib/schema";
import { normalizeSeriesCourseMeta } from "@/lib/course-flow";
import {
  normalizeAllLessonsInSeries,
} from "@/lib/lesson-frontmatter";
import { collectAllLessonTags } from "@/lib/lesson-tags";
import { htmlCommentInnerTextAtOffset } from "@/lib/html-comment-at-cursor";
import { matchLessonContentPath } from "@/lib/agent/invoke-context";
import type { AgentChatController } from "@/lib/agent-chat-controller";
import {
  loadPane4View,
  loadPane4ViewMigration,
  savePane4View,
  type Pane4View,
} from "@/lib/pane4-view-storage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  contentsEmpty?: boolean;
  workspace: { name: string; icon: string };
};

export function Workspace({
  initialSeries,
  contentsEmpty = false,
  workspace,
}: WorkspaceProps) {
  const [series, setSeries] = useState<Series[]>(() =>
    normalizeAllLessonsInSeries(normalizeSeriesCourseMeta(initialSeries)),
  );
  const [pane4ManuallyClosed, setPane4ManuallyClosed] = useState(false);
  const [pane3Mode, setPane3Mode] = useState<Pane3Mode>("raw");
  const [pane4View, setPane4View] = useState<Pane4View>("agent");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [companyContextOpen, setCompanyContextOpen] = useState(false);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const saveErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pane4UiInitialized = useRef(false);

  const handleSaveError = useCallback((msg: string) => {
    setSaveErrorMsg(msg);
    if (saveErrorTimer.current) clearTimeout(saveErrorTimer.current);
    saveErrorTimer.current = setTimeout(() => setSaveErrorMsg(null), 5000);
  }, []);
  const [editorCommentPrompt, setEditorCommentPrompt] = useState<string | null>(
    null,
  );
  const [editorCursorOffset, setEditorCursorOffset] = useState<number | null>(
    null,
  );
  const [insertCallback, setInsertCallback] = useState<
    ((markdown: string) => void) | null
  >(null);
  const [currentLessonPath, setCurrentLessonPath] = useState<string | null>(null);
  const agentChatControllerRef = useRef<AgentChatController | null>(null);
  const [streamingSwitchOpen, setStreamingSwitchOpen] = useState(false);
  const pendingSwitchRef = useRef<(() => void) | null>(null);
  const workspaceRootRef = useRef<HTMLDivElement>(null);
  const [workspaceTotalWidth, setWorkspaceTotalWidth] = useState<number | null>(
    null,
  );

  const pane4Open = !pane4ManuallyClosed;

  const { paneWidths, isResizing, resizeHandleProps, applyPaneWidths } =
    useWorkspacePaneWidths(workspaceTotalWidth, pane4Open);

  useEffect(() => {
    if (pane4UiInitialized.current) return;
    pane4UiInitialized.current = true;
    const migration = loadPane4ViewMigration();
    if (migration) {
      setPane4View(migration.pane4View);
      if (migration.openPane4) {
        setPane4ManuallyClosed(false);
      }
      savePane4View(migration.pane4View);
      return;
    }
    setPane4View(loadPane4View());
  }, []);

  useEffect(() => {
    const el = workspaceRootRef.current;
    if (!el) return;

    const updateWidth = () => {
      setWorkspaceTotalWidth(el.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const firstSeriesId = initialSeries[0]?.id ?? "";
  const firstCourseId = initialSeries[0]?.courses[0]?.id ?? "";
  const firstLessonId = initialSeries[0]?.courses[0]?.lessons[0]?.id ?? "";

  const {
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    selectedCourse,
    selectedLesson,
    selectedSeriesName,
    selectSeries,
    selectCourse,
    selectLesson,
    setSelection,
  } = useWorkspaceSelection({
    series,
    initialSeriesId: firstSeriesId,
    initialCourseId: firstCourseId,
    initialLessonId: firstLessonId,
  });

  // 作業スコープ。会話の保存先と、相対パスの基準を兼ねる。
  // フォーカス階層（最深の非空）と 1 対 1 で対応する。
  const workScope = useMemo<WorkScope>(
    () => ({
      ...(selectedSeriesName ? { series: selectedSeriesName } : {}),
      ...(selectedSeriesName && selectedCourse
        ? { course: selectedCourse.name }
        : {}),
      ...(selectedSeriesName && selectedCourse && selectedLesson
        ? { lesson: selectedLesson.lesson }
        : {}),
    }),
    [selectedSeriesName, selectedCourse, selectedLesson],
  );

  const requestSelectionChange = useCallback((action: () => void) => {
    if (agentChatControllerRef.current?.isStreaming()) {
      pendingSwitchRef.current = action;
      setStreamingSwitchOpen(true);
      return;
    }
    action();
  }, []);

  const guardedSelectLesson = useCallback(
    (lessonId: string) => {
      requestSelectionChange(() => selectLesson(lessonId));
    },
    [requestSelectionChange, selectLesson],
  );

  const guardedSelectCourse = useCallback(
    (courseId: string) => {
      requestSelectionChange(() => selectCourse(courseId));
    },
    [requestSelectionChange, selectCourse],
  );

  const guardedSelectSeries = useCallback(
    (seriesId: string) => {
      requestSelectionChange(() => selectSeries(seriesId));
    },
    [requestSelectionChange, selectSeries],
  );

  const handleConfirmStreamingSwitch = useCallback(async () => {
    const action = pendingSwitchRef.current;
    pendingSwitchRef.current = null;
    setStreamingSwitchOpen(false);
    await agentChatControllerRef.current?.interruptForSwitch();
    action?.();
  }, []);

  const {
    addSeries,
    deleteSeries,
    addCourse,
    deleteCourse,
    reorderSeries,
    reorderCourses,
    updateCourseMeta,
    updateSeriesName,
  } = useSeriesMutations({
    series,
    setSeries,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    setSelection,
    onSaveError: handleSaveError,
  });

  const handleSeriesLoaded = useCallback(
    (newSeries: Series[]) => {
      setSeries(newSeries);
    },
    [setSeries],
  );

  const cancelLessonDebounceRef = useRef<(lessonId: string) => void>(() => {});

  const handleLessonDiskSynced = useCallback((lessonId: string) => {
    cancelLessonDebounceRef.current(lessonId);
  }, []);

  const { setPendingSave } = useContentSync({
    series,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    onSeriesLoaded: handleSeriesLoaded,
    onSelectionChange: setSelection,
    onLessonDiskSynced: handleLessonDiskSynced,
  });

  const {
    addLesson,
    deleteLesson,
    reorderLessons,
    updateLessonContent,
    updateLessonMeta,
    updateLessonStatus,
    cancelLessonDebounce,
  } = useLessonMutations({
    series,
    setSeries,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    setSelection,
    setPendingSave,
    onSaveError: handleSaveError,
  });

  useEffect(() => {
    cancelLessonDebounceRef.current = cancelLessonDebounce;
  }, [cancelLessonDebounce]);

  const shouldLoadImageAssets = pane4Open || pane3Mode === "inline";
  const { availableImagePaths, imageAssetsRevision, notifyImageAssetsChanged } =
    useWorkspaceImageAssets(shouldLoadImageAssets);

  const tagSuggestions = useMemo(
    () => collectAllLessonTags(series),
    [series],
  );

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

  const handleOverwriteEditor = useCallback(
    (markdown: string) => {
      if (!selectedLesson) return;
      updateLessonContent(selectedLesson.id, markdown);
      setPane3Mode("raw");
    },
    [selectedLesson, updateLessonContent],
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

  useEffect(() => {
    if (!pane4Open || pane4View !== "agent" || !selectedLesson) {
      if (!selectedLesson) setCurrentLessonPath(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/agent/files?q=${encodeURIComponent(selectedLesson.lesson)}`,
        );
        const data = (await res.json()) as {
          files?: Array<{ path: string; name: string }>;
        };
        if (cancelled) return;
        const resolved = matchLessonContentPath(data.files ?? [], selectedLesson);
        setCurrentLessonPath(resolved);
      } catch {
        if (!cancelled) setCurrentLessonPath(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    pane4Open,
    pane4View,
    selectedLesson?.id,
    selectedLesson?.series,
    selectedLesson?.course,
    selectedLesson?.lesson,
  ]);

  const handlePane4ViewChange = useCallback((view: Pane4View) => {
    setPane4View(view);
    savePane4View(view);
  }, []);

  const handleTogglePane4 = useCallback(() => {
    setPane4ManuallyClosed((closed) => !closed);
  }, []);

  return (
    <div
      ref={workspaceRootRef}
      // ビューポート高から supergraphic 帯のぶんを引く。引かないとページ全体が
      // 帯の高さだけスクロールしてしまう
      className="h-[calc(100svh-var(--supergraphic-h))] w-full overflow-hidden"
    >
    <SidebarProvider
      defaultOpen
      data-resizing={isResizing ? "" : undefined}
      className={cn(
        "h-full w-full overflow-hidden bg-background text-foreground",
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
          selectedSeriesId={selectedSeriesId}
          onSelectSeries={guardedSelectSeries}
          selectedCourseId={selectedCourseId}
          onSelectCourse={guardedSelectCourse}
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
          seriesName={selectedSeriesName}
          courseName={selectedCourse?.name ?? ""}
          lessonName={selectedLesson?.lesson ?? ""}
          series={series}
          selectedCourseId={selectedCourseId}
          onSelectCourse={guardedSelectCourse}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCompanyContext={() => setCompanyContextOpen(true)}
        />
        <WorkspaceSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          currentPaneWidths={paneWidths}
          onApplyPaneWidths={applyPaneWidths}
        />
        <CompanyContextDialog
          open={companyContextOpen}
          onOpenChange={setCompanyContextOpen}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {contentsEmpty && (
          <div className="flex items-center justify-center border-b bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            contents/ フォルダが空です。移行スクリプトを実行してください:{" "}
            <code className="mx-1 rounded bg-amber-100 px-1 dark:bg-amber-900">
              npx tsx scripts/migrate-content.ts
            </code>
          </div>
        )}
        {saveErrorMsg && (
          <div className="flex items-center justify-center border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {saveErrorMsg}
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            className="flex h-full min-w-0 shrink-0 flex-col overflow-hidden"
            style={{ width: paneWidths.pane2 }}
          >
            <LessonListPane
              series={series}
              course={selectedCourse}
              selectedLessonId={selectedLessonId}
              onSelectLesson={guardedSelectLesson}
              onSelectCourse={guardedSelectCourse}
              onAddLesson={addLesson}
              onDeleteLesson={deleteLesson}
              onReorderLessons={reorderLessons}
              onUpdateCourseMeta={updateCourseMeta}
              onUpdateLessonStatus={updateLessonStatus}
            />
          </div>
          <PaneResizeHandle {...resizeHandleProps("pane2")} />
          <div
            className="flex h-full min-w-0 flex-1 flex-col overflow-hidden"
            style={{ minWidth: PANE3_MIN_WIDTH }}
          >
            <MarkdownEditorPane
              lesson={selectedLesson}
              series={series}
              course={selectedCourse}
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
                <Pane4Shell
                  pane4View={pane4View}
                  onPane4ViewChange={handlePane4ViewChange}
                  onTogglePane4={handleTogglePane4}
                  series={series}
                  lesson={selectedLesson}
                  course={selectedCourse}
                  workScope={workScope}
                  pane3Mode={pane3Mode}
                  onInsertImage={insertImageMarkdown}
                  editorCommentPrompt={editorCommentPrompt}
                  editorCursorOffset={editorCursorOffset}
                  onOpenSettings={() => setSettingsOpen(true)}
                  currentLessonPath={currentLessonPath}
                  agentChatControllerRef={agentChatControllerRef}
                  onOverwriteEditor={handleOverwriteEditor}
                  onImageAssetsChanged={notifyImageAssetsChanged}
                />
              </div>
            </>
          ) : (
            <div
              className="flex shrink-0 flex-col items-center border-l border-border bg-card py-3"
              style={{ width: PANE4_COLLAPSED_WIDTH }}
            >
              <Pane4Toggle
                open={false}
                onToggle={handleTogglePane4}
              />
            </div>
          )}
        </div>
        <AlertDialog open={streamingSwitchOpen} onOpenChange={setStreamingSwitchOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>AI が応答中です</AlertDialogTitle>
              <AlertDialogDescription>
                レッスンを切り替えると応答は中断されます。途中までの内容は保存され、戻ったあと「続きを生成」から再開できます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  pendingSwitchRef.current = null;
                }}
              >
                キャンセル
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleConfirmStreamingSwitch()}>
                切り替える
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </SidebarProvider>
    </div>
  );
}
