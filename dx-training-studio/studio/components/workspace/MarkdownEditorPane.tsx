"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { GitCompare, Code, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LessonMetaFields } from "@/lib/lesson-meta";
import { stripHtmlComments } from "@/lib/html-comment-at-cursor";
import { LessonMetaDialog } from "@/components/workspace/LessonMetaDialog";
import { LessonPreviewMetaRow } from "@/components/workspace/LessonPreviewMetaRow";
import { LessonDiffView } from "@/components/workspace/LessonDiffView";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { PaneKindBadge } from "@/components/workspace/metaDialogLayout";
import {
  PaneSegmentControl,
  type PaneSegmentOption,
} from "@/components/workspace/PaneSegmentControl";
import type { LessonContentEditorHandle } from "@/components/workspace/LessonContentEditor";
import type { Course, Lesson, Series } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";
import {
  createLessonPreviewMarkdownComponents,
  buildLessonPreviewRehypePlugins,
  lessonPreviewRemarkPlugins,
} from "@/lib/lesson-preview-markdown";
import "@/styles/hljs/lesson-preview-hljs.css";

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
  tagSuggestions?: readonly string[];
  availableImagePaths?: ReadonlySet<string> | null;
  imageAssetsRevision?: number;
  /** ペイン1 の中身検索の語。編集ビューとプレビューの一致箇所を塗る */
  searchHighlightQuery?: string;
};

const MODE_TABS: ReadonlyArray<PaneSegmentOption<Pane3Mode>> = [
  { value: "raw", label: "編集", icon: <Code className="h-3 w-3" /> },
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
  course,
  mode,
  onModeChange,
  onUpdateContent,
  onUpdateLessonMeta,
  onRegisterInsertCallback,
  onEditorCursorChange,
  tagSuggestions = [],
  availableImagePaths = null,
  imageAssetsRevision = 0,
  searchHighlightQuery,
}: Props) {
  const editorRef = useRef<LessonContentEditorHandle>(null);
  const paneScrollRef = useRef<HTMLElement | null>(null);
  const lastCursorOffsetRef = useRef(0);
  const [diffState, setDiffState] = useState<DiffState>({ status: "idle" });
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);

  const previewBody = useMemo(
    () => (lesson ? stripHtmlComments(lesson.content) : ""),
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

  const previewRehypePlugins = useMemo(
    () => buildLessonPreviewRehypePlugins(searchHighlightQuery),
    [searchHighlightQuery],
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
      editorRef.current?.insertAtCursor(markdown);
    },
    [],
  );

  useEffect(() => {
    onRegisterInsertCallback(insertAtCursor);
  }, [onRegisterInsertCallback, insertAtCursor]);

  useEffect(() => {
    lastCursorOffsetRef.current = 0;
  }, [lesson?.id]);

  const handleScrollElementReady = useCallback((element: HTMLElement | null) => {
    paneScrollRef.current = element;
  }, []);

  useEffect(() => {
    if (mode === "raw") {
      paneScrollRef.current = editorRef.current?.getScrollElement() ?? null;
    } else {
      paneScrollRef.current = null;
    }
  }, [mode, lesson?.id]);

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

  // フォーカスは「下があれば降りる」規則なので、lesson が無いのは
  // 選び忘れではなくフォーカス階層より下が空の場合だけ
  if (!lesson) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        {course
          ? "このコースにはまだレッスンがありません"
          : "このシリーズにはまだコースがありません"}
      </div>
    );
  }

  return (
    <PaneWheelRoot scrollRef={paneScrollRef} className="min-w-0 flex-1 bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 py-0">
        {/* 階層種別ラベル。体裁はメタビューのヘッダーと共有部品で揃える */}
        <PaneKindBadge>レッスン</PaneKindBadge>
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
          <PaneSegmentControl
            value={mode}
            options={MODE_TABS}
            onChange={onModeChange}
          />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "absolute inset-0 flex min-h-0 min-w-0 bg-background",
            mode !== "raw" && "hidden",
          )}
        >
          <LessonContentEditor
            ref={editorRef}
            lessonId={lesson.id}
            value={editContent}
            onChange={(content) => onUpdateContent(lesson.id, content)}
            onScrollElementReady={handleScrollElementReady}
            onCursorChange={handleLocalCursorChange}
            searchHighlightQuery={searchHighlightQuery}
          />
        </div>

        {mode === "inline" ? (
          <div
            ref={(el) => {
              paneScrollRef.current = el;
            }}
            className="absolute inset-0 workspace-scrollbar overflow-y-auto overscroll-y-contain px-6 py-5"
          >
            <LessonPreviewMetaRow lesson={lesson} course={course} />
            <div className={LESSON_PREVIEW_CLASS}>
              <ReactMarkdown
                key={`${lesson.id}-${imageAssetsRevision}`}
                remarkPlugins={lessonPreviewRemarkPlugins}
                rehypePlugins={previewRehypePlugins}
                components={previewMarkdownComponents}
              >
                {previewBody}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}

        {mode === "diff" ? (
          <div
            ref={(el) => {
              paneScrollRef.current = el;
            }}
            className="absolute inset-0 workspace-scrollbar overflow-y-auto overscroll-y-contain"
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
