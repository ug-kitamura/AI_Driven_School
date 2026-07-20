import {
  markdown,
  markdownLanguage,
  markdownKeymap,
} from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Compartment, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { languages } from "@codemirror/language-data";
import { LanguageDescription, foldService } from "@codemirror/language";
import { EditorView, lineNumbers } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { vscodeDarkInit, vscodeLightInit } from "@uiw/codemirror-theme-vscode";
import {
  activeLineRowHighlight,
  LESSON_ACTIVE_LINE_BG,
  LESSON_LINE_NUMBER_DARK,
  LESSON_LINE_NUMBER_LIGHT,
} from "@/lib/lesson-active-line-number";
import { lessonFoldGutter } from "@/lib/lesson-fold-gutter";
import { getFoldRangeAtLine } from "@/lib/markdown-fold-ranges";
import { clampEditorFontSizePx } from "@/lib/workspace-settings";
import { fileExtension } from "@/lib/file-preview";

/** テーマ・フォントサイズを setState なしで差し替える Compartment（モジュール共有） */
export const lessonEditorThemeCompartment = new Compartment();

/** 言語サポートを差し替える Compartment */
export const lessonEditorLanguageCompartment = new Compartment();

/** Pane3 編集ビュー: テキスト選択の背景・文字色（VS Code 既定 #add6ff を上書き） */
const LESSON_EDITOR_SELECTION_BG = "#3367d1";
const LESSON_EDITOR_SELECTION_FG = "#ffffff";

const lessonEditorSelectionTheme = EditorView.theme({
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection, .cm-line::selection":
    {
      backgroundColor: `${LESSON_EDITOR_SELECTION_BG} !important`,
      color: `${LESSON_EDITOR_SELECTION_FG} !important`,
    },
});

function editorLineHeightPx(fontSizePx: number): number {
  return Math.round(fontSizePx * 1.375);
}

function editorGutterFontSizePx(fontSizePx: number): number {
  return Math.round((fontSizePx * 11) / 14);
}

function createLessonEditorLayout(
  fontSizePx: number,
  lineNumberColor: string,
  isDark: boolean,
) {
  const lineHeightPx = editorLineHeightPx(fontSizePx);
  const gutterFontPx = editorGutterFontSizePx(fontSizePx);
  const editorBg = isDark ? "#1e1e1e" : "#ffffff";
  return EditorView.theme(
    {
      "&": { height: "100%", backgroundColor: editorBg },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        overflow: "auto",
        overscrollBehavior: "contain",
        backgroundColor: editorBg,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: `${fontSizePx}px`,
        lineHeight: `${lineHeightPx}px`,
      },
      ".cm-content": {
        padding: "0.75rem 0",
        caretColor: "var(--foreground)",
        backgroundColor: editorBg,
      },
      ".cm-gutters": {
        backgroundColor: isDark
          ? "#1e1e1e"
          : "color-mix(in oklab, var(--muted) 20%, transparent)",
        borderRight: "none",
        color: `${lineNumberColor} !important`,
        fontSize: `${gutterFontPx}px`,
        lineHeight: `${lineHeightPx}px`,
      },
      ".cm-foldGutter.lesson-fold-gutter": {
        minWidth: `${Math.max(gutterFontPx + 4, 14)}px`,
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
      ".lesson-fold-gutter .lesson-fold-icon, .lesson-fold-gutter span.lesson-fold-open, .lesson-fold-gutter span.lesson-fold-closed":
        {
          display: "inline-block",
          minWidth: "1ch",
          textAlign: "center",
          fontSize: `${gutterFontPx}px`,
          lineHeight: `${lineHeightPx}px`,
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
      ".lesson-fold-gutter.lesson-fold-gutter-column-hovered span.lesson-fold-open":
        {
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
    { dark: isDark },
  );
}

const lessonVscodeLight = vscodeLightInit({
  settings: {
    lineHighlight: "transparent",
    gutterForeground: LESSON_LINE_NUMBER_LIGHT,
    gutterActiveForeground: "",
    selection: LESSON_EDITOR_SELECTION_BG,
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
    selection: LESSON_EDITOR_SELECTION_BG,
  },
});

function createLessonMarkdownFold(enableFolding: boolean) {
  if (!enableFolding) return foldService.of(() => null);
  return foldService.of((state: EditorState, lineStart: number) => {
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
  });
}

export type LessonEditorExtensionOptions = {
  getFontSize?: () => number;
  onFontSizeChange?: (next: number) => void;
  /** false のとき折りたたみ操作は無効。gutter 列自体は常設する */
  enableFolding?: boolean;
  /** 言語解決用のファイル名（拡張子マッチ） */
  fileName?: string;
};

/** 拡張子から LanguageDescription を解決（.bat は Shell にフォールバック） */
export function matchLessonLanguageDescription(
  fileName: string,
): LanguageDescription | null {
  const matched = LanguageDescription.matchFilename(languages, fileName);
  if (matched) return matched;
  const ext = fileExtension(fileName);
  if (ext === "bat" || ext === "cmd") {
    return LanguageDescription.matchLanguageName(languages, "Shell");
  }
  return null;
}

/** Markdown または language-data 由来の LanguageSupport を返す */
export async function resolveLessonLanguageExtension(
  fileName: string,
): Promise<Extension> {
  const ext = fileExtension(fileName);
  if (ext === "md" || ext === "markdown" || ext === "mkd") {
    return [
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),
      keymap.of(markdownKeymap),
    ];
  }
  const desc = matchLessonLanguageDescription(fileName);
  if (!desc) return [];
  try {
    return await desc.load();
  } catch {
    return [];
  }
}

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

/** Pane 2 編集モード用 CodeMirror 拡張（言語は language compartment 側） */
export function buildLessonEditorExtensions(
  isDark = false,
  fontSizePx = 14,
  options?: LessonEditorExtensionOptions,
) {
  const size = clampEditorFontSizePx(fontSizePx);
  const lineNumberColor = isDark
    ? LESSON_LINE_NUMBER_DARK
    : LESSON_LINE_NUMBER_LIGHT;
  const enableFolding = options?.enableFolding ?? true;
  const extensions = [
    isDark ? lessonVscodeDark : lessonVscodeLight,
    lineNumbers(),
    ...lessonFoldGutter({ enableFolding }),
    createLessonMarkdownFold(enableFolding),
    EditorView.lineWrapping,
    ...activeLineRowHighlight(),
    createLessonEditorLayout(size, lineNumberColor, isDark),
    lessonEditorSelectionTheme,
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

/** EditorState 生成用: history / keymap + 差し替え可能テーマ／言語 */
export function buildLessonEditorStateExtensions(
  isDark = false,
  fontSizePx = 14,
  options?: LessonEditorExtensionOptions,
  extraExtensions: Extension[] = [],
  languageExtension: Extension = [],
): Extension[] {
  return [
    lessonEditorThemeCompartment.of(
      buildLessonEditorExtensions(isDark, fontSizePx, options),
    ),
    lessonEditorLanguageCompartment.of(languageExtension),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    ...extraExtensions,
  ];
}
