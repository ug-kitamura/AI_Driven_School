import {
  codeFolding,
  foldEffect,
  foldState,
  foldable,
  unfoldEffect,
} from "@codemirror/language";
import {
  GutterMarker,
  ViewPlugin,
  gutter,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import {
  RangeSet,
  RangeSetBuilder,
  type EditorState,
} from "@codemirror/state";

const FOLD_OPEN = "▼";
const FOLD_CLOSED = "▶";

/** 折りたたみ範囲の先頭文字位置 → 見出し行（折りたたみ操作行）の先頭 */
function foldHeaderPos(state: EditorState, foldFrom: number): number {
  const line = state.doc.lineAt(foldFrom);
  if (line.number <= 1) return 0;
  return state.doc.line(line.number - 1).from;
}

function findFoldAtHeader(
  state: EditorState,
  headerPos: number,
): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  const folded = state.field(foldState, false);
  if (!folded) return null;
  folded.between(0, state.doc.length, (from, to) => {
    if (foldHeaderPos(state, from) === headerPos) found = { from, to };
  });
  return found;
}

class LessonFoldOpenMarker extends GutterMarker {
  eq(other: GutterMarker): boolean {
    return other instanceof LessonFoldOpenMarker;
  }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = FOLD_OPEN;
    span.className = "lesson-fold-icon lesson-fold-open";
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}

class LessonFoldClosedMarker extends GutterMarker {
  eq(other: GutterMarker): boolean {
    return other instanceof LessonFoldClosedMarker;
  }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = FOLD_CLOSED;
    span.className = "lesson-fold-icon lesson-fold-closed";
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}

const openMarker = new LessonFoldOpenMarker();
const closedMarker = new LessonFoldClosedMarker();

/** 折りたたみ列にマウスがある間、全 ▼（見出し + FM）を表示 */
const FOLD_GUTTER_COLUMN_HOVER_CLASS = "lesson-fold-gutter-column-hovered";

function setFoldGutterColumnHover(view: EditorView, hovered: boolean) {
  const gutter = view.dom.querySelector<HTMLElement>(".lesson-fold-gutter");
  if (!gutter) return;
  gutter.classList.toggle(FOLD_GUTTER_COLUMN_HOVER_CLASS, hovered);
}

function buildFoldGutterMarkers(view: EditorView) {
  const { state } = view;
  const builder = new RangeSetBuilder<GutterMarker>();
  const foldedHeaders = new Set<number>();

  state.field(foldState, false)?.between(0, state.doc.length, (from, to) => {
    foldedHeaders.add(foldHeaderPos(state, from));
  });

  for (const line of view.viewportLineBlocks) {
    if (foldedHeaders.has(line.from)) {
      builder.add(line.from, line.from, closedMarker);
      continue;
    }
    if (foldable(state, line.from, line.to)) {
      builder.add(line.from, line.from, openMarker);
    }
  }
  return builder.finish();
}

const foldMarkerPlugin = ViewPlugin.fromClass(
  class {
    markers: RangeSet<GutterMarker> = RangeSet.empty;

    constructor(view: EditorView) {
      this.markers = buildFoldGutterMarkers(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.startState.field(foldState, false) !==
          update.state.field(foldState, false)
      ) {
        this.markers = buildFoldGutterMarkers(update.view);
      }
    }
  },
);

/** 見出し行に ▼/▶ を付ける折りたたみガター（標準 foldGutter の代替） */
export function lessonFoldGutter() {
  return [
    foldMarkerPlugin,
    gutter({
      class: "cm-foldGutter lesson-fold-gutter",
      markers: (view) =>
        view.plugin(foldMarkerPlugin)?.markers ?? RangeSet.empty,
      domEventHandlers: {
        mousemove: (view) => {
          setFoldGutterColumnHover(view, true);
          return false;
        },
        mouseleave: (view) => {
          setFoldGutterColumnHover(view, false);
          return false;
        },
        click: (view, line, event) => {
          const folded = findFoldAtHeader(view.state, line.from);
          if (folded) {
            view.dispatch({ effects: unfoldEffect.of(folded) });
            return true;
          }
          const range = foldable(view.state, line.from, line.to);
          if (range) {
            view.dispatch({ effects: foldEffect.of(range) });
            return true;
          }
          return false;
        },
      },
    }),
    codeFolding(),
  ];
}
