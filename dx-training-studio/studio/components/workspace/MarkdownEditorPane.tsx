"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import { GitCompare, Code, Eye, Edit3, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLessonEnBody } from "@/components/workspace/hooks/use-lesson-en-body";
import {
  TranslationHeaderControls,
  type EditLanguage,
} from "@/components/workspace/translation/TranslationHeaderControls";
import type { TranslationFreshness } from "@/lib/translation/client";
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
  /** レッスンの編集言語（本文とメタダイアログが連動する1スイッチ） */
  editLanguage: EditLanguage;
  onEditLanguageChange: (language: EditLanguage) => void;
  /** 鮮度チップ（本文とメタの悪いほう）。未取得は undefined */
  translationStatus: TranslationFreshness | undefined;
  onMarkFresh?: () => void;
  /** 英語側の保存・翻訳適用の後に呼ぶ（鮮度チップの再取得） */
  onTranslationChanged?: () => void;
  onSaveError?: (message: string) => void;
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
  editLanguage,
  onEditLanguageChange,
  translationStatus,
  onMarkFresh,
  onTranslationChanged,
  onSaveError,
}: Props) {
  const editorRef = useRef<LessonContentEditorHandle>(null);
  const paneScrollRef = useRef<HTMLElement | null>(null);
  const lastCursorOffsetRef = useRef(0);
  const [diffState, setDiffState] = useState<DiffState>({ status: "idle" });
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);

  const isEnglish = editLanguage === "en";
  const enBody = useLessonEnBody({
    enabled: isEnglish,
    series: lesson?.series,
    course: lesson?.course,
    lesson: lesson?.lesson,
    onSaveError,
    onSaved: onTranslationChanged,
  });

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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 差分取得ライフサイクルを持つ effect の「対象外」側。取得中の結果が後から届いても idle に戻す
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
          <TranslationHeaderControls
            language={editLanguage}
            onLanguageChange={onEditLanguageChange}
            status={translationStatus}
            onMarkFresh={onMarkFresh}
          />
          {/* 本文翻訳は英語モードのヘッダーにだけ出す（エディタ本体には置かない） */}
          {isEnglish ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 shrink-0 px-2 text-xs"
              onClick={enBody.translate}
              disabled={enBody.translating || enBody.state.status !== "ready"}
            >
              {enBody.translating ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-3" aria-hidden />
              )}
              本文を翻訳
            </Button>
          ) : null}
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
          {/* 英語モードは編集ビュー固定（プレビュー/差分は日本語本文の機能） */}
          {isEnglish ? null : (
            <PaneSegmentControl
              value={mode}
              options={MODE_TABS}
              onChange={onModeChange}
            />
          )}
        </div>
      </div>

      {isEnglish ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {enBody.translateError ? (
            <div className="border-b border-border bg-destructive/10 px-4 py-1.5 text-xs text-destructive">
              {enBody.translateError}
            </div>
          ) : null}
          {enBody.state.status === "ready" ? (
            <div className="absolute inset-0 flex min-h-0 min-w-0 bg-background">
              <LessonContentEditor
                ref={editorRef}
                lessonId={`${lesson.id}:en`}
                value={enBody.state.body}
                onChange={enBody.updateBody}
                onScrollElementReady={handleScrollElementReady}
                searchHighlightQuery={searchHighlightQuery}
              />
            </div>
          ) : enBody.state.status === "error" ? (
            <div className="flex h-full items-center justify-center px-4 text-sm text-destructive">
              {enBody.state.message}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              英語版を読み込み中...
            </div>
          )}
        </div>
      ) : (

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
      )}

      <LessonMetaDialog
        open={metaDialogOpen}
        onOpenChange={setMetaDialogOpen}
        lesson={lesson}
        onSave={onUpdateLessonMeta}
        tagSuggestions={tagSuggestions}
        language={editLanguage}
        onTranslationChanged={onTranslationChanged}
      />
    </PaneWheelRoot>
  );
}
