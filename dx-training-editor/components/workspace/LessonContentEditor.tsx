"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import { cn } from "@/lib/utils";
import { buildLessonEditorExtensions } from "@/lib/lesson-content-editor-setup";

export type LessonContentEditorHandle = {
  insertAtCursor: (markdown: string) => void;
  getScrollElement: () => HTMLElement | null;
};

type Props = {
  lessonId: string;
  value: string;
  onChange: (value: string) => void;
  onScrollElementReady?: (element: HTMLElement | null) => void;
  className?: string;
};

export const LessonContentEditor = forwardRef<
  LessonContentEditorHandle,
  Props
>(function LessonContentEditor(
  { lessonId, value, onChange, onScrollElementReady, className },
  ref,
) {
  const viewRef = useRef<EditorView | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  const extensions = useMemo(
    () => buildLessonEditorExtensions(isDark),
    [isDark],
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
      insertAtCursor(markdown: string) {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: markdown },
          selection: { anchor: from + markdown.length },
          scrollIntoView: true,
        });
        onChange(view.state.doc.toString());
        view.focus();
      },
      getScrollElement() {
        return viewRef.current?.scrollDOM ?? null;
      },
    }),
    [onChange],
  );

  return (
    <CodeMirror
      key={`${lessonId}-${isDark ? "dark" : "light"}`}
      value={value}
      height="100%"
      className={cn(
        "lesson-content-editor h-full min-h-0 min-w-0 flex-1 [&_.cm-editor]:h-full",
        className,
      )}
      extensions={extensions}
      onChange={onChange}
      onCreateEditor={handleCreateEditor}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        highlightSelectionMatches: false,
        autocompletion: false,
      }}
      spellCheck={false}
      placeholder="フロントマターとマークダウン本文..."
    />
  );
});
