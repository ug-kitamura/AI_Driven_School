"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.min.css";
import { GitCompare, Code, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLessonBody } from "@/lib/lesson-frontmatter";
import { LessonMetaDialog } from "@/components/workspace/LessonMetaDialog";
import { LessonDiffView } from "@/components/workspace/LessonDiffView";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import type { LessonContentEditorHandle } from "@/components/workspace/LessonContentEditor";
import type { Lesson } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";
import type { LessonMetaFields } from "@/lib/lesson-frontmatter";

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

type Props = {
  lesson: Lesson | undefined;
  mode: Pane3Mode;
  onModeChange: (mode: Pane3Mode) => void;
  onUpdateContent: (lessonId: string, content: string) => void;
  onUpdateLessonMeta: (
    lessonId: string,
    meta: Partial<LessonMetaFields>,
  ) => void;
  onRegisterInsertCallback: (cb: (markdown: string) => void) => void;
  tagSuggestions?: readonly string[];
};

const MODE_TABS: Array<{ value: Pane3Mode; label: string; icon: React.ReactNode }> =
  [
    { value: "raw", label: "編集モード", icon: <Code className="h-3 w-3" /> },
    { value: "inline", label: "プレビュー", icon: <Eye className="h-3 w-3" /> },
    {
      value: "diff",
      label: "差分",
      icon: <GitCompare className="h-3 w-3" />,
    },
  ];

const LESSON_PREVIEW_CLASS = "lesson-preview";

type DiffState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; diff: string }
  | { status: "error"; message: string };

export function MarkdownEditorPane({
  lesson,
  mode,
  onModeChange,
  onUpdateContent,
  onUpdateLessonMeta,
  onRegisterInsertCallback,
  tagSuggestions = [],
}: Props) {
  const editorRef = useRef<LessonContentEditorHandle>(null);
  const paneScrollRef = useRef<HTMLElement | null>(null);
  const [diffState, setDiffState] = useState<DiffState>({ status: "idle" });
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);

  const previewBody = useMemo(
    () => (lesson ? getLessonBody(lesson) : ""),
    [lesson],
  );

  const editContent = lesson?.content ?? "";

  const insertAtCursor = useCallback(
    (markdown: string) => {
      editorRef.current?.insertAtCursor(markdown);
    },
    [],
  );

  useEffect(() => {
    onRegisterInsertCallback(insertAtCursor);
  }, [onRegisterInsertCallback, insertAtCursor]);

  const handleScrollElementReady = useCallback((element: HTMLElement | null) => {
    paneScrollRef.current = element;
  }, []);

  useEffect(() => {
    if (mode !== "raw") {
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

  if (!lesson) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        レッスンを選択してください
      </div>
    );
  }

  return (
    <PaneWheelRoot scrollRef={paneScrollRef} className="min-w-0 flex-1 bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 py-0">
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {lesson.lesson}
        </h2>
        <div className="ml-auto flex items-center gap-2">
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

      <div className="min-h-0 flex-1 overflow-hidden">
        {mode === "raw" && (
          <div className="flex h-full min-h-0 min-w-0 bg-muted/20">
            <LessonContentEditor
              ref={editorRef}
              lessonId={lesson.id}
              value={editContent}
              onChange={(content) => onUpdateContent(lesson.id, content)}
              onScrollElementReady={handleScrollElementReady}
            />
          </div>
        )}

        {mode === "inline" && (
          <div
            ref={(el) => {
              paneScrollRef.current = el;
            }}
            className="h-full overflow-y-auto overscroll-y-contain px-6 py-5"
          >
            <div className={LESSON_PREVIEW_CLASS}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {previewBody}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {mode === "diff" && (
          <div
            ref={(el) => {
              paneScrollRef.current = el;
            }}
            className="h-full overflow-y-auto overscroll-y-contain"
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
        )}
      </div>

      <LessonMetaDialog
        open={metaDialogOpen}
        onOpenChange={setMetaDialogOpen}
        lesson={lesson}
        onSave={onUpdateLessonMeta}
        tagSuggestions={tagSuggestions}
      />
    </PaneWheelRoot>
  );
}
