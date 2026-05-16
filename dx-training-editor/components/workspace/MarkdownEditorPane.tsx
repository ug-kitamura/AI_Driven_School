"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, GitCompare, Code, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";

type Props = {
  lesson: Lesson | undefined;
  mode: Pane3Mode;
  onModeChange: (mode: Pane3Mode) => void;
  onUpdateContent: (lessonId: string, content: string) => void;
  onRegisterInsertCallback: (cb: (markdown: string) => void) => void;
};

const MODE_TABS: Array<{ value: Pane3Mode; label: string; icon: React.ReactNode }> =
  [
    { value: "raw", label: "Markdown", icon: <Code className="h-3 w-3" /> },
    { value: "inline", label: "プレビュー", icon: <Eye className="h-3 w-3" /> },
    {
      value: "diff",
      label: "差分",
      icon: <GitCompare className="h-3 w-3" />,
    },
  ];

export function MarkdownEditorPane({
  lesson,
  mode,
  onModeChange,
  onUpdateContent,
  onRegisterInsertCallback,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [diffContent, setDiffContent] = useState<string>("");
  const [diffLoading, setDiffLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 画像挿入コールバックを登録
  const insertAtCursor = useCallback((markdown: string) => {
    const ta = textareaRef.current;
    if (!ta || !lesson) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = lesson.content.slice(0, start);
    const after = lesson.content.slice(end);
    const newContent = before + markdown + after;
    onUpdateContent(lesson.id, newContent);
    // カーソルを挿入後に移動
    requestAnimationFrame(() => {
      ta.setSelectionRange(
        start + markdown.length,
        start + markdown.length,
      );
      ta.focus();
    });
  }, [lesson, onUpdateContent]);

  useEffect(() => {
    onRegisterInsertCallback(insertAtCursor);
  }, [onRegisterInsertCallback, insertAtCursor]);

  // 差分表示モードで API を呼ぶ
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

  // ファイルを読み込む
  const handleFileOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lesson) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      onUpdateContent(lesson.id, text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!lesson) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        レッスンを選択してください
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 flex-col bg-card">
      {/* ツールバー */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {/* モード切り替えタブ */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {MODE_TABS.map((tab) => (
            <button
              key={tab.value}
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

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleFileOpen}
          >
            <FileText className="h-3 w-3" />
            ファイルを開く
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* コンテンツエリア */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Raw Markdown モード */}
        {mode === "raw" && (
          <textarea
            ref={textareaRef}
            value={lesson.content}
            onChange={(e) => onUpdateContent(lesson.id, e.target.value)}
            className="h-full w-full resize-none bg-card px-4 py-3 font-mono text-sm text-foreground outline-none"
            placeholder="マークダウンをここに入力してください..."
            spellCheck={false}
          />
        )}

        {/* プレビューモード */}
        {mode === "inline" && (
          <div className="h-full overflow-y-auto px-6 py-4">
            <div className="prose prose-sm max-w-none text-foreground
              prose-headings:text-foreground
              prose-p:text-foreground
              prose-strong:text-foreground
              prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
              prose-pre:bg-slate-900 prose-pre:text-slate-100
              prose-blockquote:border-primary prose-blockquote:text-muted-foreground
              prose-li:text-foreground">
              <ReactMarkdown>{lesson.content}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* 差分表示モード */}
        {mode === "diff" && (
          <div className="h-full overflow-y-auto">
            {diffLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
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
                          line.startsWith("+") &&
                            !line.startsWith("+++")
                            ? "bg-green-500/10 text-green-700"
                            : line.startsWith("-") &&
                                !line.startsWith("---")
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
    </div>
  );
}
