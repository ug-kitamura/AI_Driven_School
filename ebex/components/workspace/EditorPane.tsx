"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Code, Eye } from "lucide-react";
import {
  PaneSegmentControl,
  type PaneSegmentOption,
} from "@/components/workspace/PaneSegmentControl";
import { FilePreview } from "@/components/workspace/FilePreview";
import { fileExtension, supportsPreview } from "@/lib/file-preview";
import type { LessonContentEditorHandle } from "@/components/workspace/LessonContentEditor";

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

export type EditorViewMode = "edit" | "preview";

const MODE_TABS: ReadonlyArray<PaneSegmentOption<EditorViewMode>> = [
  { value: "edit", label: "Edit", icon: <Code className="size-3.5" /> },
  { value: "preview", label: "Preview", icon: <Eye className="size-3.5" /> },
];

type Props = {
  folderPath: string;
  fileName: string;
  content: string;
  onContentChange: (content: string) => void;
  onSave: (content: string) => Promise<void>;
  onPendingSaveChange: (pending: boolean) => void;
  onRegisterInsertCallback: (cb: (markdown: string) => void) => void;
  onRegisterOverwriteCallback: (cb: (markdown: string) => void) => void;
};

const SAVE_DEBOUNCE_MS = 800;

export function EditorPane({
  folderPath,
  fileName,
  content,
  onContentChange,
  onSave,
  onPendingSaveChange,
  onRegisterInsertCallback,
  onRegisterOverwriteCallback,
}: Props) {
  const [mode, setMode] = useState<EditorViewMode>("edit");
  const editorRef = useRef<LessonContentEditorHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileKey = `${folderPath}/${fileName}`;
  const enableFolding = fileExtension(fileName) === "md";

  const scheduleSave = useCallback(
    (nextContent: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      onPendingSaveChange(true);
      saveTimerRef.current = setTimeout(() => {
        void onSave(nextContent).finally(() => onPendingSaveChange(false));
      }, SAVE_DEBOUNCE_MS);
    },
    [onSave, onPendingSaveChange],
  );

  const handleChange = useCallback(
    (next: string) => {
      onContentChange(next);
      scheduleSave(next);
    },
    [onContentChange, scheduleSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    onRegisterInsertCallback((markdown) => {
      editorRef.current?.insertAtCursor(markdown);
    });
    onRegisterOverwriteCallback((markdown) => {
      onContentChange(markdown);
      scheduleSave(markdown);
    });
  }, [
    onRegisterInsertCallback,
    onRegisterOverwriteCallback,
    onContentChange,
    scheduleSave,
  ]);

  const showPreview = mode === "preview" && supportsPreview(fileName);

  if (!folderPath || !fileName) {
    return (
      <div className="flex h-full flex-col">
        <EditorHeader title="ファイルを選択してください" muted />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Pane 1 からフォルダとファイルを選択してください
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorHeader
        title={fileName}
        modeControl={
          supportsPreview(fileName) ? (
            <PaneSegmentControl
              value={mode}
              onChange={setMode}
              options={MODE_TABS}
              variant="underline"
            />
          ) : null
        }
      />
      <div
        className={
          showPreview
            ? "workspace-scrollbar min-h-0 flex-1 overflow-y-auto"
            : "min-h-0 flex-1 overflow-hidden"
        }
      >
        {showPreview ? (
          <FilePreview fileName={fileName} content={content} />
        ) : (
          <LessonContentEditor
            key={fileKey}
            ref={editorRef}
            lessonId={fileKey}
            value={content}
            onChange={handleChange}
            enableFolding={enableFolding}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}

function EditorHeader({
  title,
  modeControl,
  muted = false,
}: {
  title: string;
  modeControl?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 py-0">
      <span
        className={
          muted
            ? "mr-auto min-w-0 truncate text-sm text-muted-foreground"
            : "mr-auto min-w-0 truncate text-sm font-medium"
        }
      >
        {title}
      </span>
      {modeControl}
    </div>
  );
}
