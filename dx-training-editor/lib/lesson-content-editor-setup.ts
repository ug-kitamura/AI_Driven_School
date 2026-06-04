import { markdown, markdownLanguage, markdownKeymap } from "@codemirror/lang-markdown";
import { keymap } from "@codemirror/view";
import { languages } from "@codemirror/language-data";
import { foldService } from "@codemirror/language";
import { lessonFoldGutter } from "@/lib/lesson-fold-gutter";
import { EditorView, lineNumbers } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { vscodeDarkInit, vscodeLightInit } from "@uiw/codemirror-theme-vscode";
import {
  activeLineRowHighlight,
  LESSON_ACTIVE_LINE_BG,
  LESSON_LINE_NUMBER_DARK,
  LESSON_LINE_NUMBER_LIGHT,
} from "@/lib/lesson-active-line-number";
import { getFoldRangeAtLine } from "@/lib/markdown-fold-ranges";
import {
  frontmatterEditorTheme,
  frontmatterHighlight,
} from "@/lib/lesson-frontmatter-highlight";
import { clampEditorFontSizePx } from "@/lib/workspace-settings";

function editorLineHeightPx(fontSizePx: number): number {
  return Math.round(fontSizePx * 1.375);
}

function editorGutterFontSizePx(fontSizePx: number): number {
  return Math.round((fontSizePx * 11) / 14);
}

function createLessonEditorLayout(
  fontSizePx: number,
  lineNumberColor: string,
) {
  const lineHeightPx = editorLineHeightPx(fontSizePx);
  const gutterFontPx = editorGutterFontSizePx(fontSizePx);
  return EditorView.theme(
    {
      "&": { height: "100%" },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        overflow: "auto",
        overscrollBehavior: "contain",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: `${fontSizePx}px`,
        lineHeight: `${lineHeightPx}px`,
      },
      ".cm-content": {
        padding: "0.75rem 0",
        caretColor: "var(--foreground)",
      },
      ".cm-gutters": {
        backgroundColor: "color-mix(in oklab, var(--muted) 20%, transparent)",
        borderRight: "none",
        color: `${lineNumberColor} !important`,
        fontSize: `${gutterFontPx}px`,
        lineHeight: `${lineHeightPx}px`,
      },
      ".lesson-fold-gutter .cm-gutterElement": {
        padding: "0 2px",
        color: lineNumberColor,
        cursor: "default",
        width: "100%",
        boxSizing: "border-box",
      },
      ".lesson-fold-gutter .cm-gutterElement:has(.lesson-fold-icon)": {
        cursor: "pointer",
      },
      ".cm-foldGutter.lesson-fold-gutter .lesson-fold-icon": {
        color: `${lineNumberColor} !important`,
      },
      ".cm-foldGutter.lesson-fold-gutter span.lesson-fold-open": {
        color: `${lineNumberColor} !important`,
      },
      ".cm-foldGutter.lesson-fold-gutter span.lesson-fold-closed": {
        color: `${lineNumberColor} !important`,
      },
      ".lesson-fold-gutter span.lesson-fold-open": {
        opacity: "0",
        pointerEvents: "none",
      },
      ".lesson-fold-gutter.lesson-fold-gutter-column-hovered span.lesson-fold-open": {
        opacity: "1",
        pointerEvents: "none",
      },
      ".lesson-fold-gutter span.lesson-fold-closed": {
        opacity: "1",
        pointerEvents: "auto",
      },
      ".cm-gutterElement.lesson-active-line-gutter": {
        backgroundColor: `${LESSON_ACTIVE_LINE_BG} !important`,
      },
      ".cm-line.lesson-active-line": {
        backgroundColor: `${LESSON_ACTIVE_LINE_BG} !important`,
      },
      ".cm-lineNumbers .cm-gutterElement.lesson-active-line-number": {
        fontWeight: "700",
      },
    },
    { dark: false },
  );
}

const lessonVscodeLight = vscodeLightInit({
  settings: {
    lineHighlight: "transparent",
    gutterForeground: LESSON_LINE_NUMBER_LIGHT,
    gutterActiveForeground: "",
  },
});

const lessonVscodeDark = vscodeDarkInit({
  settings: {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    lineHighlight: "transparent",
    gutterForeground: LESSON_LINE_NUMBER_DARK,
    gutterBackground: "#1e1e1e",
    gutterActiveForeground: "#c6c6c6",
  },
});

const lessonMarkdownFold = foldService.of(
  (state: EditorState, lineStart: number) => {
    const lineIndex = state.doc.lineAt(lineStart).number - 1;
    const lines = state.doc.toString().split("\n");
    const range = getFoldRangeAtLine(lines, lineIndex);
    if (!range) return null;

    const docLines = state.doc.lines;
    if (range.fromLineIndex >= docLines) return null;
    const from = state.doc.line(range.fromLineIndex + 1).from;
    const toLine = Math.min(range.toLineIndex + 1, docLines);
    const to = state.doc.line(toLine).to;
    if (from >= to) return null;
    return { from, to };
  },
);

/** Ctrl+ホイールでフォントサイズ変更（編集モードのみ） */
export function editorFontSizeWheelExtension(
  getSize: () => number,
  onSizeChange: (next: number) => void,
) {
  return EditorView.domEventHandlers({
    wheel(event) {
      if (!event.ctrlKey) return false;
      event.preventDefault();
      const step = event.deltaY < 0 ? 1 : -1;
      onSizeChange(clampEditorFontSizePx(getSize() + step));
      return true;
    },
  });
}

/** Pane3 編集モード用 CodeMirror 拡張 */
export function buildLessonEditorExtensions(
  isDark = false,
  fontSizePx = 14,
  options?: {
    getFontSize?: () => number;
    onFontSizeChange?: (next: number) => void;
  },
) {
  const size = clampEditorFontSizePx(fontSizePx);
  const lineNumberColor = isDark
    ? LESSON_LINE_NUMBER_DARK
    : LESSON_LINE_NUMBER_LIGHT;
  const extensions = [
    isDark ? lessonVscodeDark : lessonVscodeLight,
    lineNumbers(),
    ...lessonFoldGutter(),
    lessonMarkdownFold,
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),
    keymap.of(markdownKeymap),
    EditorView.lineWrapping,
    frontmatterHighlight,
    frontmatterEditorTheme,
    ...activeLineRowHighlight(),
    createLessonEditorLayout(size, lineNumberColor),
  ];
  if (options?.onFontSizeChange) {
    extensions.push(
      editorFontSizeWheelExtension(
        options.getFontSize ?? (() => size),
        options.onFontSizeChange,
      ),
    );
  }
  return extensions;
}
