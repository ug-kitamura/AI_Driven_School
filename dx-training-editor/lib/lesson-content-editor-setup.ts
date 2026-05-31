import { markdown, markdownLanguage, markdownKeymap } from "@codemirror/lang-markdown";
import { keymap } from "@codemirror/view";
import { yaml } from "@codemirror/lang-yaml";
import {
  foldGutter,
  foldService,
  LanguageDescription,
} from "@codemirror/language";
import { EditorView, lineNumbers } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { vscodeLight } from "@uiw/codemirror-theme-vscode";
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
      color: "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
      fontSize: "11px",
      lineHeight: "1.375rem",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent" },
    ".cm-foldGutter .cm-gutterElement": {
      padding: "0 2px",
      cursor: "pointer",
    },
  },
  { dark: false },
);

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
    vscodeLight,
    lessonEditorLayout,
    lineNumbers(),
    foldGutter({ openText: "▼", closedText: "▶" }),
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
  ];
}
