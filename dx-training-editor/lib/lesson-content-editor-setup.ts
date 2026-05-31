import { markdown, markdownLanguage, markdownKeymap } from "@codemirror/lang-markdown";
import { keymap } from "@codemirror/view";
import { yaml } from "@codemirror/lang-yaml";
import { foldService, LanguageDescription } from "@codemirror/language";
import { lessonFoldGutter } from "@/lib/lesson-fold-gutter";
import { EditorView, lineNumbers } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { vscodeLightInit } from "@uiw/codemirror-theme-vscode";
import {
  activeLineRowHighlight,
  LESSON_ACTIVE_LINE_BG,
  LESSON_LINE_NUMBER,
} from "@/lib/lesson-active-line-number";
import { getFoldRangeAtLine } from "@/lib/markdown-fold-ranges";
import {
  frontmatterEditorTheme,
  frontmatterHighlight,
} from "@/lib/lesson-frontmatter-highlight";

const lessonEditorLayout = EditorView.theme(
  {
    "&": { height: "100%" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      overflow: "auto",
      overscrollBehavior: "contain",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: "0.875rem",
      lineHeight: "1.375rem",
    },
    ".cm-content": {
      padding: "0.75rem 0",
      caretColor: "var(--foreground)",
    },
    ".cm-gutters": {
      backgroundColor: "color-mix(in oklab, var(--muted) 20%, transparent)",
      borderRight: "none",
      color: LESSON_LINE_NUMBER,
      fontSize: "11px",
      lineHeight: "1.375rem",
    },
    ".lesson-fold-gutter .cm-gutterElement": {
      padding: "0 2px",
      color: LESSON_LINE_NUMBER,
      cursor: "default",
      width: "100%",
      boxSizing: "border-box",
    },
    ".lesson-fold-gutter .cm-gutterElement:has(.lesson-fold-icon)": {
      cursor: "pointer",
    },
    /* ▼: 折りたたみ列ホバー時に全セクション+FM 分を表示 ▶: 常時 */
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

/** vscode 既定の行ハイライト背景を無効化 */
const lessonVscodeLight = vscodeLightInit({
  settings: {
    lineHighlight: "transparent",
    gutterForeground: LESSON_LINE_NUMBER,
    gutterActiveForeground: "",
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

/** Pane3 編集モード用 CodeMirror 拡張 */
export function buildLessonEditorExtensions() {
  return [
    lessonVscodeLight,
    lineNumbers(),
    ...lessonFoldGutter(),
    lessonMarkdownFold,
    markdown({
      base: markdownLanguage,
      codeLanguages: [
        LanguageDescription.of({
          name: "yaml",
          alias: ["yml"],
          load: () => Promise.resolve(yaml()),
        }),
      ],
    }),
    keymap.of(markdownKeymap),
    EditorView.lineWrapping,
    frontmatterHighlight,
    frontmatterEditorTheme,
    ...activeLineRowHighlight(),
    lessonEditorLayout,
  ];
}
