"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Code, Eye } from "lucide-react";
import {
  PaneSegmentControl,
  type PaneSegmentOption,
} from "@/components/workspace/PaneSegmentControl";
import { FilePreview } from "@/components/workspace/FilePreview";
import { ImageFileView } from "@/components/workspace/ImageFileView";
import { PdfFileView } from "@/components/workspace/PdfFileView";
import { ZipFileView } from "@/components/workspace/ZipFileView";
import { UnsupportedFileView } from "@/components/workspace/UnsupportedFileView";
import {
  fileExtension,
  isTextEditableMode,
  resolveInitialViewMode,
  resolvePane2Mode,
  resolveViewOnlyKind,
} from "@/lib/file-preview";
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
  /** 空フォルダの `no file` センチネル選択時 */
  isNoFileEmptySelection?: boolean;
  content: string;
  isResizing?: boolean;
  onContentChange: (content: string) => void;
  onSave: (content: string) => Promise<void>;
  onPendingSaveChange: (pending: boolean) => void;
  onRegisterInsertCallback: (cb: (markdown: string) => void) => void;
  onRegisterOverwriteCallback: (cb: (markdown: string) => void) => void;
  /** MD プレビュー内のプロジェクト内リンクでファイルを開く */
  onOpenFile?: (folderPath: string, fileName: string) => void;
  /** Pane 1 の内容検索の語。編集ビューとプレビューの一致箇所を塗る */
  searchHighlightQuery?: string;
};

const SAVE_DEBOUNCE_MS = 800;

export function EditorPane(props: Props) {
  const { folderPath, fileName, isNoFileEmptySelection = false } = props;
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

  if (isNoFileEmptySelection) {
    return (
      <div className="flex h-full flex-col">
        <EditorHeader title={fileName} />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          ファイルが存在しません
        </div>
      </div>
    );
  }

  return <EditorPaneActive key={`${folderPath}/${fileName}`} {...props} />;
}

function EditorPaneActive({
  folderPath,
  fileName,
  content,
  isResizing = false,
  onContentChange,
  onSave,
  onPendingSaveChange,
  onRegisterInsertCallback,
  onRegisterOverwriteCallback,
  onOpenFile,
  searchHighlightQuery,
}: Props) {
  // ファイル切替は key リマウントのため、初期モードは拡張子ごとにここで決まる
  const [mode, setMode] = useState<EditorViewMode>(() =>
    resolveInitialViewMode(fileName),
  );
  const editorRef = useRef<LessonContentEditorHandle>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileKey = `${folderPath}/${fileName}`;
  const pane2Mode = resolvePane2Mode(fileName);
  const enableFolding = fileExtension(fileName) === "md";
  const canEditText = isTextEditableMode(pane2Mode);
  const showModeTabs = pane2Mode === "edit-preview";
  const showPreview = showModeTabs && mode === "preview";
  const viewKind = resolveViewOnlyKind(fileName);

  const scheduleSave = useCallback(
    (nextContent: string) => {
      if (!canEditText) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      onPendingSaveChange(true);
      saveTimerRef.current = setTimeout(() => {
        void onSave(nextContent).finally(() => onPendingSaveChange(false));
      }, SAVE_DEBOUNCE_MS);
    },
    [canEditText, onSave, onPendingSaveChange],
  );

  const handleChange = useCallback(
    (next: string) => {
      if (!canEditText) return;
      onContentChange(next);
      scheduleSave(next);
    },
    [canEditText, onContentChange, scheduleSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        onPendingSaveChange(false);
      }
    };
  }, [onPendingSaveChange]);

  useEffect(() => {
    onRegisterInsertCallback((markdown) => {
      if (!canEditText) return;
      editorRef.current?.insertAtCursor(markdown);
    });
    onRegisterOverwriteCallback((markdown) => {
      if (!canEditText) return;
      onContentChange(markdown);
      scheduleSave(markdown);
    });
  }, [
    canEditText,
    onRegisterInsertCallback,
    onRegisterOverwriteCallback,
    onContentChange,
    scheduleSave,
  ]);

  let body: React.ReactNode;
  if (pane2Mode === "unsupported") {
    body = <UnsupportedFileView fileName={fileName} />;
  } else if (pane2Mode === "view-only") {
    if (viewKind === "image") {
      body = <ImageFileView folderPath={folderPath} fileName={fileName} />;
    } else if (viewKind === "pdf") {
      body = <PdfFileView folderPath={folderPath} fileName={fileName} />;
    } else if (viewKind === "zip") {
      body = <ZipFileView folderPath={folderPath} fileName={fileName} />;
    } else {
      body = <UnsupportedFileView fileName={fileName} />;
    }
  } else if (showPreview) {
    body = (
      <FilePreview
        fileName={fileName}
        content={content}
        isResizing={isResizing}
        folderPath={folderPath}
        onOpenFile={onOpenFile}
        searchHighlightQuery={searchHighlightQuery}
      />
    );
  } else {
    body = (
      <LessonContentEditor
        key={fileKey}
        ref={editorRef}
        lessonId={fileKey}
        fileName={fileName}
        value={content}
        onChange={handleChange}
        enableFolding={enableFolding}
        searchHighlightQuery={searchHighlightQuery}
        className="h-full"
      />
    );
  }

  // HTML プレビューは iframe 内でスクロールする（実体のあるビューポートを与えるため）。
  // 外側もスクロールさせると二重スクロールになるので overflow-hidden にする。
  const isHtmlPreview =
    showPreview && ["html", "htm"].includes(fileExtension(fileName));

  const bodyClassName = showPreview
    ? isHtmlPreview
      ? "min-h-0 flex-1 overflow-hidden bg-card"
      : "workspace-scrollbar min-h-0 flex-1 overflow-y-auto bg-card"
    : pane2Mode === "view-only" || pane2Mode === "unsupported"
      ? "min-h-0 flex-1 overflow-hidden bg-card"
      : "min-h-0 flex-1 overflow-hidden";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorHeader
        title={fileName}
        modeControl={
          showModeTabs ? (
            <PaneSegmentControl
              value={mode}
              onChange={setMode}
              options={MODE_TABS}
              variant="underline"
            />
          ) : null
        }
      />
      <div className={bodyClassName}>{body}</div>
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
