import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type EditorView as EditorViewType,
  type ViewUpdate,
} from "@codemirror/view";
import { findFrontmatterCloseLine } from "@/lib/markdown-fold-ranges";

const FM_COLOR =
  "color-mix(in oklab, var(--muted-foreground) 88%, transparent)";

/** vscode テーマより後に載せ、FM ブロックを薄いグレーにする */
export const frontmatterEditorTheme = EditorView.theme({
  ".cm-frontmatter-fade": {
    color: FM_COLOR,
  },
  ".cm-frontmatter-fade *": {
    color: FM_COLOR,
  },
});

const frontmatterMark = Decoration.mark({
  class: "cm-frontmatter-fade",
});

function buildFrontmatterDecorations(view: EditorViewType): DecorationSet {
  const doc = view.state.doc;
  const lines = doc.toString().split("\n");
  const close = findFrontmatterCloseLine(lines);
  if (close === null) return Decoration.none;

  const to = doc.line(close + 1).to;
  if (to <= 0) return Decoration.none;

  return Decoration.set([frontmatterMark.range(0, to)]);
}

/** 先頭 YAML フロントマター全体を薄いグレーで表示 */
export const frontmatterHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorViewType) {
      this.decorations = buildFrontmatterDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildFrontmatterDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
