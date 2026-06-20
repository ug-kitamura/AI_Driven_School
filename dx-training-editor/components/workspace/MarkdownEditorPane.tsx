"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.min.css";
import { GitCompare, Code, Eye, Edit3, Bot, AlertTriangle, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLessonBody, type LessonMetaFields } from "@/lib/lesson-frontmatter";
import { stripHtmlComments } from "@/lib/html-comment-at-cursor";
import { LessonMetaDialog } from "@/components/workspace/LessonMetaDialog";
import { LessonDiffView } from "@/components/workspace/LessonDiffView";
import { AgentChatPane } from "@/components/workspace/AgentChatPane";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import type { LessonContentEditorHandle } from "@/components/workspace/LessonContentEditor";
import type { Course, Lesson, Series } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";
import type { DisplayLanguage } from "@/lib/workspace-settings";
import { createLessonPreviewMarkdownComponents } from "@/lib/lesson-preview-markdown";

const LessonContentEditor = dynamic(
  () =>
    import("@/components/workspace/LessonContentEditor").then(
      (m) => m.LessonContentEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        エディタを読み込み中...
      </div>
    ),
  },
);

type EnState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "stale"; content: string; jaCurrentHash: string }
  | { status: "ok"; content: string };

type Props = {
  lesson: Lesson | undefined;
  series: Series[];
  course: Course | undefined;
  mode: Pane3Mode;
  onModeChange: (mode: Pane3Mode) => void;
  onUpdateContent: (lessonId: string, content: string) => void;
  onUpdateLessonMeta: (
    lessonId: string,
    meta: Partial<LessonMetaFields>,
  ) => void;
  onRegisterInsertCallback: (cb: (markdown: string) => void) => void;
  onEditorCursorChange?: (offset: number) => void;
  onInsertAgentMarkdown: (markdown: string) => void;
  onOpenSettings: () => void;
  currentLessonPath: string | null;
  tagSuggestions?: readonly string[];
  availableImagePaths?: ReadonlySet<string> | null;
  imageAssetsRevision?: number;
  displayLanguage?: DisplayLanguage;
};

const MODE_TABS: Array<{ value: Pane3Mode; label: string; icon: React.ReactNode }> =
  [
    { value: "raw", label: "編集", icon: <Code className="h-3 w-3" /> },
    { value: "inline", label: "プレビュー", icon: <Eye className="h-3 w-3" /> },
    {
      value: "diff",
      label: "差分",
      icon: <GitCompare className="h-3 w-3" />,
    },
    { value: "agent", label: "Agent", icon: <Bot className="h-3 w-3" /> },
  ];

const LESSON_PREVIEW_CLASS = "lesson-preview";

type DiffState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; diff: string }
  | { status: "error"; message: string };

export function MarkdownEditorPane({
  lesson,
  series,
  course,
  mode,
  onModeChange,
  onUpdateContent,
  onUpdateLessonMeta,
  onRegisterInsertCallback,
  onEditorCursorChange,
  onInsertAgentMarkdown,
  onOpenSettings,
  currentLessonPath,
  tagSuggestions = [],
  availableImagePaths = null,
  imageAssetsRevision = 0,
  displayLanguage = "ja",
}: Props) {
  const editorRef = useRef<LessonContentEditorHandle>(null);
  const paneScrollRef = useRef<HTMLElement | null>(null);
  const lastCursorOffsetRef = useRef(0);
  const [diffState, setDiffState] = useState<DiffState>({ status: "idle" });
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [enState, setEnState] = useState<EnState>({ status: "idle" });
  const [savingEn, setSavingEn] = useState(false);

  const previewBody = useMemo(
    () => (lesson ? stripHtmlComments(getLessonBody(lesson)) : ""),
    [lesson],
  );

  const previewMarkdownComponents = useMemo(
    () =>
      createLessonPreviewMarkdownComponents({
        availableImagePaths,
        imageAssetsRevision,
      }),
    [availableImagePaths, imageAssetsRevision],
  );

  const editContent = lesson?.content ?? "";

  const handleLocalCursorChange = useCallback(
    (offset: number) => {
      lastCursorOffsetRef.current = offset;
      onEditorCursorChange?.(offset);
    },
    [onEditorCursorChange],
  );

  const insertAtCursor = useCallback(
    (markdown: string) => {
      if (!markdown) return;
      if (mode === "agent" && lesson) {
        const content = lesson.content;
        const offset = Math.max(
          0,
          Math.min(lastCursorOffsetRef.current, content.length),
        );
        const next =
          content.slice(0, offset) + markdown + content.slice(offset);
        onUpdateContent(lesson.id, next);
        lastCursorOffsetRef.current = offset + markdown.length;
        return;
      }
      editorRef.current?.insertAtCursor(markdown);
    },
    [lesson, mode, onUpdateContent],
  );

  useEffect(() => {
    onRegisterInsertCallback(insertAtCursor);
  }, [onRegisterInsertCallback, insertAtCursor]);

  useEffect(() => {
    lastCursorOffsetRef.current = 0;
  }, [lesson?.id]);

  // 英語版コンテンツ読み込み
  useEffect(() => {
    if (displayLanguage !== "en" || !lesson) {
      setEnState({ status: "idle" });
      return;
    }
    const seriesSlug = lesson.series;
    const courseSlug = lesson.course;
    const lessonSlug = lesson.slug ?? lesson.lesson;
    setEnState({ status: "loading" });
    fetch("/api/content/load-en", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ series: seriesSlug, course: courseSlug, lesson: lessonSlug }),
    })
      .then(async (res) => {
        if (!res.ok) { setEnState({ status: "missing" }); return; }
        const data = await res.json() as {
          exists: boolean;
          content?: string;
          isStale?: boolean;
          jaCurrentHash?: string;
        };
        if (!data.exists) {
          setEnState({ status: "missing" });
        } else if (data.isStale) {
          setEnState({ status: "stale", content: data.content ?? "", jaCurrentHash: data.jaCurrentHash ?? "" });
        } else {
          setEnState({ status: "ok", content: data.content ?? "" });
        }
      })
      .catch(() => setEnState({ status: "missing" }));
  }, [displayLanguage, lesson?.id, lesson?.series, lesson?.course, lesson?.slug, lesson?.lesson]);

  const handleSaveEnContent = useCallback(
    (content: string) => {
      if (!lesson) return;
      setSavingEn(true);
      fetch("/api/content/save-en", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: lesson.series,
          course: lesson.course,
          lesson: lesson.slug ?? lesson.lesson,
          content,
        }),
      })
        .then(async (res) => {
          if (res.ok) {
            setEnState({ status: "ok", content });
          }
        })
        .catch(() => {})
        .finally(() => setSavingEn(false));
    },
    [lesson],
  );

  const handleScrollElementReady = useCallback((element: HTMLElement | null) => {
    paneScrollRef.current = element;
  }, []);

  useEffect(() => {
    if (mode !== "raw" && mode !== "agent") {
      paneScrollRef.current = null;
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "diff" || !lesson) {
      setDiffState({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    setDiffState({ status: "loading" });

    fetch("/api/lesson-diff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        lessonId: lesson.id,
        content: lesson.content,
        series: lesson.series,
        course: lesson.course,
        lesson: lesson.lesson,
      }),
    })
      .then(async (response) => {
        const data: { diff?: string; error?: string } = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "差分の取得に失敗しました");
        }
        setDiffState({ status: "ready", diff: data.diff ?? "" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setDiffState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "差分の取得に失敗しました",
        });
      });

    return () => controller.abort();
  }, [
    mode,
    lesson?.id,
    lesson?.content,
    lesson?.series,
    lesson?.course,
    lesson?.lesson,
  ]);

  if (!lesson && mode !== "agent") {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        レッスンを選択してください
      </div>
    );
  }

  const headerTitle = lesson?.lesson ?? "Agent";

  return (
    <PaneWheelRoot scrollRef={paneScrollRef} className="min-w-0 flex-1 bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 py-0">
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {headerTitle}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {lesson ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mr-1 h-6 w-6 shrink-0"
              aria-label="レッスンメタを編集"
              onClick={() => setMetaDialogOpen(true)}
            >
              <Edit3 className="h-3 w-3" />
            </Button>
          ) : null}
          <div className="flex overflow-hidden rounded-md border border-border">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => onModeChange(tab.value)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
                  mode === tab.value
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* 英語版: displayLanguage=en かつ diff/agent 以外のモード */}
        {displayLanguage === "en" && lesson && mode !== "diff" && mode !== "agent" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {enState.status === "stale" && (
              <div className="flex shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="flex-1 text-xs text-amber-700 dark:text-amber-300">
                  日本語原文が更新されています。英語版が古い可能性があります。
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  disabled={savingEn}
                  onClick={() => handleSaveEnContent(enState.content)}
                >
                  {savingEn ? "保存中..." : "ハッシュを更新"}
                </Button>
              </div>
            )}
            <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5">
              {enState.status === "loading" ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  英語版を読み込み中...
                </div>
              ) : enState.status === "missing" ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Languages className="size-10 opacity-40" />
                  <p className="text-sm">英語版がまだ作成されていません</p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={savingEn}
                    onClick={() => handleSaveEnContent("")}
                  >
                    {savingEn ? "作成中..." : "英語版を作成（空ファイル）"}
                  </Button>
                </div>
              ) : (enState.status === "ok" || enState.status === "stale") ? (
                <div className={LESSON_PREVIEW_CLASS}>
                  <ReactMarkdown
                    key={`${lesson.id}-en`}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={previewMarkdownComponents}
                  >
                    {(enState as { content: string }).content}
                  </ReactMarkdown>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* 日本語: displayLanguage=ja または diff/agent モード */}
        {(displayLanguage !== "en" || mode === "diff" || mode === "agent") && (
          <>
            {mode === "raw" && lesson ? (
              <div className="flex h-full min-h-0 min-w-0 bg-background">
                <LessonContentEditor
                  ref={editorRef}
                  lessonId={lesson.id}
                  value={editContent}
                  onChange={(content) => onUpdateContent(lesson.id, content)}
                  onScrollElementReady={handleScrollElementReady}
                  onCursorChange={handleLocalCursorChange}
                />
              </div>
            ) : null}

            {mode === "agent" ? (
              <AgentChatPane
                series={series}
                lesson={lesson}
                course={course}
                currentLessonPath={currentLessonPath}
                onOpenSettings={onOpenSettings}
              />
            ) : null}

            {mode === "inline" && lesson ? (
              <div
                ref={(el) => {
                  paneScrollRef.current = el;
                }}
                className="workspace-scrollbar h-full overflow-y-auto overscroll-y-contain px-6 py-5"
              >
                <div className={LESSON_PREVIEW_CLASS}>
                  <ReactMarkdown
                    key={`${lesson.id}-${imageAssetsRevision}`}
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={previewMarkdownComponents}
                  >
                    {previewBody}
                  </ReactMarkdown>
                </div>
              </div>
            ) : null}

            {mode === "diff" && lesson ? (
              <div
                ref={(el) => {
                  paneScrollRef.current = el;
                }}
                className="workspace-scrollbar h-full overflow-y-auto overscroll-y-contain"
              >
                {diffState.status === "loading" ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    差分を取得中...
                  </div>
                ) : diffState.status === "error" ? (
                  <div className="flex h-full items-center justify-center px-4 text-sm text-destructive">
                    {diffState.message}
                  </div>
                ) : diffState.status === "ready" ? (
                  <LessonDiffView diff={diffState.diff} />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {lesson ? (
        <LessonMetaDialog
          open={metaDialogOpen}
          onOpenChange={setMetaDialogOpen}
          lesson={lesson}
          onSave={onUpdateLessonMeta}
          tagSuggestions={tagSuggestions}
        />
      ) : null}
    </PaneWheelRoot>
  );
}
