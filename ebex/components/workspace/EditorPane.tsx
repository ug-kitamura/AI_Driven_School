"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Code, Eye, Leaf, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PaneSegmentControl,
  type PaneSegmentOption,
} from "@/components/workspace/PaneSegmentControl";
import { FilePreview } from "@/components/workspace/FilePreview";
import { supportsPreview } from "@/lib/file-preview";
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
  { value: "edit", label: "編集", icon: <Code className="size-3" /> },
  { value: "preview", label: "プレビュー", icon: <Eye className="size-3" /> },
];

type Props = {
  folderPath: string;
  fileName: string;
  content: string;
  onContentChange: (content: string) => void;
  onSave: (content: string) => Promise<void>;
  onPendingSaveChange: (pending: boolean) => void;
  onOpenSettings: () => void;
  onOpenPurpose: () => void;
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
  onOpenSettings,
  onOpenPurpose,
  onRegisterInsertCallback,
  onRegisterOverwriteCallback,
}: Props) {
  const [mode, setMode] = useState<EditorViewMode>("edit");
  const editorRef = useRef<LessonContentEditorHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileKey = `${folderPath}/${fileName}`;

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
        <EditorHeader
          breadcrumb="ファイルを選択してください"
          onOpenPurpose={onOpenPurpose}
          onOpenSettings={onOpenSettings}
        />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Pane 1 からフォルダとファイルを選択してください
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorHeader
        breadcrumb={`${folderPath} / ${fileName}`}
        onOpenPurpose={onOpenPurpose}
        onOpenSettings={onOpenSettings}
        modeControl={
          supportsPreview(fileName) ? (
            <PaneSegmentControl
              value={mode}
              onChange={setMode}
              options={MODE_TABS}
            />
          ) : null
        }
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {showPreview ? (
          <FilePreview fileName={fileName} content={content} />
        ) : (
          <LessonContentEditor
            key={fileKey}
            ref={editorRef}
            lessonId={fileKey}
            value={content}
            onChange={handleChange}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}

function EditorHeader({
  breadcrumb,
  onOpenPurpose,
  onOpenSettings,
  modeControl,
}: {
  breadcrumb: string;
  onOpenPurpose: () => void;
  onOpenSettings: () => void;
  modeControl?: React.ReactNode;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 py-0">
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {breadcrumb}
      </span>
      {modeControl}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="EBE Purpose"
        onClick={onOpenPurpose}
      >
        <Leaf className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="設定"
        onClick={onOpenSettings}
      >
        <Settings className="size-4" />
      </Button>
    </div>
  );
}
