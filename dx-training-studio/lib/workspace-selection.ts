import type { Series } from "@/lib/schema";
import { parseLessonDocument } from "@/lib/lesson-frontmatter";

/**
 * ペイン1〜3 のフォーカス。末尾から空になる。
 *
 * フォーカス階層は「下の階層があれば先頭へ降り、無ければその階層で止まる」規則で決まるため、
 * 下位が埋まっているのに上位で止まる状態は存在しない。したがって階層を表す判別フィールドは
 * 持たず、`selectionLevel` で最深の非空フィールドから導出する。
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

/** シリーズを起点に、下の階層があれば先頭へ降りる。 */
export function focusSeries(
  series: Series[],
  seriesId: string,
): WorkspaceSelection {
  const s = series.find((item) => item.id === seriesId);
  if (!s) return EMPTY_SELECTION;
  const course = s.courses[0];
  if (!course) return { seriesId, courseId: "", lessonId: "" };
  return {
    seriesId,
    courseId: course.id,
    lessonId: course.lessons[0]?.id ?? "",
  };
}

/** コースを起点に、レッスンがあれば先頭へ降りる。 */
export function focusCourse(
  series: Series[],
  courseId: string,
): WorkspaceSelection {
  for (const s of series) {
    const c = s.courses.find((course) => course.id === courseId);
    if (c) {
      return {
        seriesId: s.id,
        courseId,
        lessonId: c.lessons[0]?.id ?? "",
      };
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
    // どちらも無い保存値は復元の手がかりが無いので捨てる
    if (!seriesId && !courseId) return null;
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
  if (!selection.seriesId && !selection.courseId) return;
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

  // レッスンが実在すればそこを起点にする（seriesId は逆引きで補完される）
  if (stored.lessonId && findLessonById(series, stored.lessonId)) {
    return focusLesson(series, stored.lessonId);
  }

  // コースが実在すれば降下規則を当てる。旧形式（seriesId 無し）はここで補完される
  if (stored.courseId && findCourseById(series, stored.courseId)) {
    return focusCourse(series, stored.courseId);
  }

  // コースを持たないシリーズにフォーカスしていた場合
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

function findCourseContainingLesson(series: Series[], lessonId: string) {
  for (const s of series) {
    for (const c of s.courses) {
      if (c.lessons.some((l) => l.id === lessonId)) return c;
    }
  }
  return undefined;
}

function lessonBody(content: string): string {
  return parseLessonDocument(content).body;
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
    // レッスンが消えた場合はコースに止まる（降下規則で先頭へ降りると別レッスンへ飛ぶ）
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

  // コースを持たないシリーズにフォーカスしていた場合
  if (seriesId && freshSeries.some((s) => s.id === seriesId)) {
    return focusSeries(freshSeries, seriesId);
  }

  return selection;
}

function findSeriesContainingCourse(series: Series[], courseId: string) {
  return series.find((s) => s.courses.some((c) => c.id === courseId));
}

/** 残った先頭シリーズを起点に降下規則を当てる（フォールバック）。 */
function firstSelection(nextSeries: Series[]): WorkspaceSelection {
  const firstSeries = nextSeries[0];
  if (!firstSeries) return EMPTY_SELECTION;
  return focusSeries(nextSeries, firstSeries.id);
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
    // フォーカス中のシリーズそのものが消えた場合も含めて判定する
    if (deleted.seriesId === selectedSeriesId) {
      return firstSelection(nextSeries);
    }
    const removed = prevSeries.find((s) => s.id === deleted.seriesId);
    const hadSelectedCourse =
      removed?.courses.some((c) => c.id === selectedCourseId) ?? false;
    if (hadSelectedCourse) {
      return firstSelection(nextSeries);
    }
    return current;
  }

  if (selectedCourseId === deleted.courseId) {
    // 同じシリーズに残る。残コースがあれば先頭へ降り、無ければシリーズで止まる
    if (selectedSeriesId && nextSeries.some((s) => s.id === selectedSeriesId)) {
      return focusSeries(nextSeries, selectedSeriesId);
    }
    return firstSelection(nextSeries);
  }
  return current;
}
