import type { Series } from "@/lib/schema";

/**
 * ワークスペースのフォーカス。末尾から空になる。
 *
 * 選択はクリックした階層で止まり、下位フィールドは空になる。3 フィールドすべてが
 * 空の状態は「ホーム（全体）」選択を表す。階層を表す判別フィールドは持たず、
 * `selectionLevel` で最深の非空フィールドから導出する。
 */
export type WorkspaceSelection = {
  seriesId: string;
  courseId: string;
  lessonId: string;
};

export type SelectionLevel = "lesson" | "course" | "series" | "none";

export function selectionLevel(selection: WorkspaceSelection): SelectionLevel {
  if (selection.lessonId) return "lesson";
  if (selection.courseId) return "course";
  if (selection.seriesId) return "series";
  return "none";
}

const EMPTY_SELECTION: WorkspaceSelection = {
  seriesId: "",
  courseId: "",
  lessonId: "",
};

/** ホーム（全体）選択。 */
export function focusHome(): WorkspaceSelection {
  return EMPTY_SELECTION;
}

/** シリーズを選択する。下位階層へは降りない。 */
export function focusSeries(
  series: Series[],
  seriesId: string,
): WorkspaceSelection {
  const s = series.find((item) => item.id === seriesId);
  if (!s) return EMPTY_SELECTION;
  return { seriesId, courseId: "", lessonId: "" };
}

/** コースを選択する（所属シリーズを補完）。下位階層へは降りない。 */
export function focusCourse(
  series: Series[],
  courseId: string,
): WorkspaceSelection {
  for (const s of series) {
    const c = s.courses.find((course) => course.id === courseId);
    if (c) {
      return { seriesId: s.id, courseId, lessonId: "" };
    }
  }
  return EMPTY_SELECTION;
}

/** レッスンを起点にフォーカスを組み立てる（これ以上は降りられない）。 */
export function focusLesson(
  series: Series[],
  lessonId: string,
): WorkspaceSelection {
  for (const s of series) {
    for (const c of s.courses) {
      if (c.lessons.some((l) => l.id === lessonId)) {
        return { seriesId: s.id, courseId: c.id, lessonId };
      }
    }
  }
  return EMPTY_SELECTION;
}

import { STORAGE_KEYS } from "@/lib/storage-keys";

const SELECTION_STORAGE_KEY = STORAGE_KEYS.selection;

/**
 * 保存済みの選択を読む。`seriesId` を持たない旧形式（`{ courseId, lessonId }`）でも
 * 失敗させない——所属シリーズは `resolveInitialSelection` が `courseId` から逆引きする。
 * 3 フィールドが揃って空文字の保存値はホーム選択として有効（保存値なしとは区別する）。
 */
export function loadStoredSelection(): WorkspaceSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      seriesId?: unknown;
      courseId?: unknown;
      lessonId?: unknown;
    };
    const seriesId = typeof parsed.seriesId === "string" ? parsed.seriesId : "";
    const courseId = typeof parsed.courseId === "string" ? parsed.courseId : "";
    // 明示的な全空（ホーム選択の保存）だけは有効。それ以外で手がかりが無い値は捨てる
    if (!seriesId && !courseId) {
      const isExplicitHome =
        parsed.seriesId === "" && parsed.courseId === "" && parsed.lessonId === "";
      return isExplicitHome ? { ...EMPTY_SELECTION } : null;
    }
    return {
      seriesId,
      courseId,
      lessonId: typeof parsed.lessonId === "string" ? parsed.lessonId : "",
    };
  } catch {
    return null;
  }
}

export function saveStoredSelection(selection: WorkspaceSelection): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* ignore quota */
  }
}

/** リロード時に localStorage の選択を series 上で検証して復元する */
export function resolveInitialSelection(
  series: Series[],
  fallback: WorkspaceSelection,
): WorkspaceSelection {
  const stored = loadStoredSelection();
  if (!stored) return fallback;

  // ホーム選択（全空）はそのまま復元する
  if (!stored.seriesId && !stored.courseId && !stored.lessonId) {
    return focusHome();
  }

  // レッスンが実在すればそこを起点にする（seriesId は逆引きで補完される）
  if (stored.lessonId && findLessonById(series, stored.lessonId)) {
    return focusLesson(series, stored.lessonId);
  }

  // コースが実在すればコースで止める。旧形式（seriesId 無し）はここで補完される
  if (stored.courseId && findCourseById(series, stored.courseId)) {
    return focusCourse(series, stored.courseId);
  }

  // シリーズにフォーカスしていた場合
  if (stored.seriesId && series.some((s) => s.id === stored.seriesId)) {
    return focusSeries(series, stored.seriesId);
  }

  return fallback;
}

export type DeleteTarget =
  | { kind: "series"; seriesId: string }
  | { kind: "course"; courseId: string };

function findCourseById(series: Series[], courseId: string) {
  for (const s of series) {
    const c = s.courses.find((co) => co.id === courseId);
    if (c) return c;
  }
  return undefined;
}

function findLessonById(series: Series[], lessonId: string) {
  for (const s of series) {
    for (const c of s.courses) {
      for (const l of c.lessons) {
        if (l.id === lessonId) return l;
      }
    }
  }
  return undefined;
}

function lessonBody(content: string): string {
  // content は本文のみ（frontmatter は廃止済み）
  return content;
}

/**
 * ディスク上の変更（外部リネーム等）で ID が変わったあと、
 * 選択中のコース・レッスンを freshSeries 上の対応エントリへ引き継ぐ。
 */
export function resolveSelectionAfterContentReload(
  prevSeries: Series[],
  freshSeries: Series[],
  selection: WorkspaceSelection,
): WorkspaceSelection {
  const { seriesId, courseId, lessonId } = selection;

  if (lessonId && findLessonById(freshSeries, lessonId)) {
    return focusLesson(freshSeries, lessonId);
  }

  const prevLesson = lessonId ? findLessonById(prevSeries, lessonId) : undefined;
  if (prevLesson) {
    const body = lessonBody(prevLesson.content);
    for (const s of freshSeries) {
      for (const c of s.courses) {
        for (const l of c.lessons) {
          if (lessonBody(l.content) === body) {
            return { seriesId: s.id, courseId: c.id, lessonId: l.id };
          }
        }
      }
    }
  }

  if (courseId && findCourseById(freshSeries, courseId)) {
    // レッスンが消えた場合はコースに止まる
    const found = findSeriesContainingCourse(freshSeries, courseId);
    return { seriesId: found?.id ?? seriesId, courseId, lessonId: "" };
  }

  const prevCourse = courseId ? findCourseById(prevSeries, courseId) : undefined;
  if (prevCourse) {
    for (const s of freshSeries) {
      const c = s.courses.find((co) => co.name === prevCourse.name);
      if (c) {
        return { seriesId: s.id, courseId: c.id, lessonId: "" };
      }
    }
  }

  // シリーズにフォーカスしていた場合
  if (seriesId && freshSeries.some((s) => s.id === seriesId)) {
    return focusSeries(freshSeries, seriesId);
  }

  return selection;
}

function findSeriesContainingCourse(series: Series[], courseId: string) {
  return series.find((s) => s.courses.some((c) => c.id === courseId));
}

export function resolveSelectionAfterDelete(params: {
  prevSeries: Series[];
  nextSeries: Series[];
  selectedSeriesId: string;
  selectedCourseId: string;
  selectedLessonId: string;
  deleted: DeleteTarget;
}): WorkspaceSelection {
  const {
    prevSeries,
    nextSeries,
    selectedSeriesId,
    selectedCourseId,
    selectedLessonId,
    deleted,
  } = params;
  const current: WorkspaceSelection = {
    seriesId: selectedSeriesId,
    courseId: selectedCourseId,
    lessonId: selectedLessonId,
  };

  if (deleted.kind === "series") {
    // フォーカス中のシリーズそのものが消えた場合も含めて判定する。
    // 削除された階層の親＝全体（ホーム）へフォーカスする
    if (deleted.seriesId === selectedSeriesId) {
      return focusHome();
    }
    const removed = prevSeries.find((s) => s.id === deleted.seriesId);
    const hadSelectedCourse =
      removed?.courses.some((c) => c.id === selectedCourseId) ?? false;
    if (hadSelectedCourse) {
      return focusHome();
    }
    return current;
  }

  if (selectedCourseId === deleted.courseId) {
    // 削除された階層の親＝所属シリーズで止まる
    if (selectedSeriesId && nextSeries.some((s) => s.id === selectedSeriesId)) {
      return focusSeries(nextSeries, selectedSeriesId);
    }
    return focusHome();
  }
  return current;
}
