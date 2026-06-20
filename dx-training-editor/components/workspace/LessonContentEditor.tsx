"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useCallback,
  useState,
  useEffect,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { cn } from "@/lib/utils";
import { buildLessonEditorExtensions } from "@/lib/lesson-content-editor-setup";
import { getLessonBodyStartOffset } from "@/lib/lesson-frontmatter";
import { useResolvedDarkMode } from "@/lib/use-resolved-dark-mode";
import {
  clampEditorFontSizePx,
  EDITOR_FONT_SIZE_CHANGED_EVENT,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
} from "@/lib/workspace-settings";

export type LessonContentEditorHandle = {
  insertAtCursor: (markdown: string, options?: { focus?: boolean }) => void;
  getScrollElement: () => HTMLElement | null;
  getCursorOffset: () => number;
};

type Props = {
  lessonId: string;
  value: string;
  onChange: (value: string) => void;
  onScrollElementReady?: (element: HTMLElement | null) => void;
  onCursorChange?: (offset: number) => void;
  className?: string;
};

export const LessonContentEditor = forwardRef<
  LessonContentEditorHandle,
  Props
>(function LessonContentEditor(
  { lessonId, value, onChange, onScrollElementReady, onCursorChange, className },
  ref,
) {
  const viewRef = useRef<EditorView | null>(null);
  const onCursorChangeRef = useRef(onCursorChange);
  onCursorChangeRef.current = onCursorChange;
  const isDark = useResolvedDarkMode();
  const [fontSizePx, setFontSizePx] = useState(() =>
    clampEditorFontSizePx(loadWorkspaceSettings().editorFontSizePx),
  );
  const fontSizeRef = useRef(fontSizePx);
  fontSizeRef.current = fontSizePx;

  const handleFontSizeChange = useCallback((next: number) => {
    const clamped = clampEditorFontSizePx(next);
    setFontSizePx(clamped);
    const settings = loadWorkspaceSettings();
    saveWorkspaceSettings({ ...settings, editorFontSizePx: clamped });
  }, []);

  useEffect(() => {
    const onExternalFontSize = (event: Event) => {
      const px = (event as CustomEvent<{ px: number }>).detail?.px;
      if (typeof px === "number") {
        setFontSizePx(clampEditorFontSizePx(px));
      }
    };
    window.addEventListener(EDITOR_FONT_SIZE_CHANGED_EVENT, onExternalFontSize);
    return () =>
      window.removeEventListener(EDITOR_FONT_SIZE_CHANGED_EVENT, onExternalFontSize);
  }, []);

  const extensions = useMemo(
    () => [
      ...buildLessonEditorExtensions(isDark, fontSizePx, {
        getFontSize: () => fontSizeRef.current,
        onFontSizeChange: handleFontSizeChange,
      }),
      EditorView.updateListener.of((update) => {
        if (update.selectionSet || update.docChanged) {
          onCursorChangeRef.current?.(update.state.selection.main.head);
        }
      }),
    ],
    [isDark, fontSizePx, handleFontSizeChange],
  );

  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      viewRef.current = view;
      onScrollElementReady?.(view.scrollDOM);
    },
    [onScrollElementReady],
  );

  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor(markdown: string, options?: { focus?: boolean }) {
        const view = viewRef.current;
        if (!view || !markdown) return;
        const doc = view.state.doc;
        const docText = doc.toString();
        const bodyStart = getLessonBodyStartOffset(docText);
        const sel = view.state.selection.main;
        let from = Math.min(sel.from, sel.to);
        let to = Math.max(sel.from, sel.to);
        from = Math.max(bodyStart, Math.min(from, doc.length));
        to = Math.max(from, Math.min(to, doc.length));
        const cursor = from + markdown.length;
        view.dispatch({
          changes: { from, to, insert: markdown },
          selection: { anchor: cursor, head: cursor },
          scrollIntoView: true,
        });
        onChange(view.state.doc.toString());
        if (options?.focus !== false) {
          view.focus();
        }
      },
      getScrollElement() {
        return viewRef.current?.scrollDOM ?? null;
      },
      getCursorOffset() {
        return viewRef.current?.state.selection.main.head ?? 0;
      },
    }),
    [onChange],
  );

  return (
    <CodeMirror
      key={`${lessonId}-${isDark ? "dark" : "light"}`}
      theme="none"
      value={value}
      height="100%"
      className={cn(
        "lesson-content-editor h-full min-h-0 min-w-0 flex-1 [&_.cm-editor]:h-full",
        isDark && "lesson-content-editor--dark",
        className,
      )}
      extensions={extensions}
      onChange={onChange}
      onCreateEditor={handleCreateEditor}
      basicSetup={{
        history: true,
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
          highlightSelectionMatches: false,
          autocompletion: false,
          drawSelection: false,
      }}
      spellCheck={false}
      placeholder="フロントマターとマークダウン本文..."
    />
  );
});
