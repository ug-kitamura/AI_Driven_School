"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GitCompare, Code, Eye, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLessonBody } from "@/lib/lesson-frontmatter";
import { LessonMetaDialog } from "@/components/workspace/LessonMetaDialog";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import type { Lesson } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";
import type { LessonMetaFields } from "@/lib/lesson-frontmatter";

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

export function MarkdownEditorPane({
  lesson,
  mode,
  onModeChange,
  onUpdateContent,
  onUpdateLessonMeta,
  onRegisterInsertCallback,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const paneScrollRef = useRef<HTMLElement | null>(null);
  const [diffContent, setDiffContent] = useState<string>("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);

  const previewBody = useMemo(
    () => (lesson ? getLessonBody(lesson) : ""),
    [lesson],
  );

  const editContent = lesson?.content ?? "";

  const lineNumbers = useMemo(() => {
    const count = Math.max(1, editContent.split("\n").length);
    return Array.from({ length: count }, (_, i) => i + 1);
  }, [editContent]);

  const insertAtCursor = useCallback(
    (markdown: string) => {
      const ta = textareaRef.current;
      if (!ta || !lesson) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = editContent.slice(0, start);
      const after = editContent.slice(end);
      onUpdateContent(lesson.id, before + markdown + after);
      requestAnimationFrame(() => {
        const pos = start + markdown.length;
        ta.setSelectionRange(pos, pos);
        ta.focus();
      });
    },
    [editContent, lesson, onUpdateContent],
  );

  useEffect(() => {
    onRegisterInsertCallback(insertAtCursor);
  }, [onRegisterInsertCallback, insertAtCursor]);

  const syncGutterScroll = useCallback(() => {
    const ta = textareaRef.current;
    const gutter = gutterRef.current;
    if (ta && gutter) gutter.scrollTop = ta.scrollTop;
  }, []);

  useEffect(() => {
    if (mode !== "diff" || !lesson) {
      setDiffContent("");
      return;
    }
    setDiffLoading(true);
    const filePath = encodeURIComponent(
      `dx-training-editor/data/${lesson.id}.md`,
    );
    fetch(`/api/git-diff?path=${filePath}`)
      .then((r) => r.json())
      .then((data: { diff: string }) => {
        setDiffContent(data.diff || "（差分なし）");
      })
      .catch(() => {
        setDiffContent("（差分の取得に失敗しました）");
      })
      .finally(() => setDiffLoading(false));
  }, [mode, lesson]);

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
          <div className="flex h-full min-h-0 min-w-0">
            <div
              ref={gutterRef}
              aria-hidden
              className="shrink-0 overflow-hidden bg-muted/20 px-2 py-3 text-right font-mono text-[11px] leading-[1.375rem] text-muted-foreground/50 tabular-nums select-none"
            >
              {lineNumbers.map((n) => (
                <div key={n}>{n}</div>
              ))}
            </div>
            <textarea
              ref={(el) => {
                textareaRef.current = el;
                paneScrollRef.current = el;
              }}
              value={editContent}
              onChange={(e) => onUpdateContent(lesson.id, e.target.value)}
              onScroll={syncGutterScroll}
              className="h-full min-w-0 flex-1 resize-none overflow-y-auto overscroll-y-contain bg-muted/20 px-4 py-3 font-mono text-sm leading-[1.375rem] text-foreground outline-none"
              placeholder="フロントマターとマークダウン本文..."
              spellCheck={false}
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewBody}</ReactMarkdown>
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
            {diffLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                差分を取得中...
              </div>
            ) : (
              <pre className="h-full overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs text-foreground">
                {diffContent
                  ? diffContent.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          "leading-relaxed",
                          line.startsWith("+") && !line.startsWith("+++")
                            ? "bg-green-500/10 text-green-700"
                            : line.startsWith("-") && !line.startsWith("---")
                              ? "bg-red-500/10 text-red-700"
                              : line.startsWith("@@")
                                ? "text-blue-600"
                                : "",
                        )}
                      >
                        {line || "\u00A0"}
                      </div>
                    ))
                  : "（差分なし）"}
              </pre>
            )}
          </div>
        )}
      </div>

      <LessonMetaDialog
        open={metaDialogOpen}
        onOpenChange={setMetaDialogOpen}
        lesson={lesson}
        onSave={onUpdateLessonMeta}
      />
    </PaneWheelRoot>
  );
}
