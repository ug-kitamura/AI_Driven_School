/**
 * コースの受講順・前提/続きリンクのドメインロジック。
 * シリーズ内順序は series.courses[] のみ。prerequisites / next_courses は別シリーズ ID のみ。
 */

import type { Series, Course } from "@/lib/schema";

export type CourseRef = { id: string; name: string };

export type IntraSeriesNeighbors = {
  prev: CourseRef | null;
  next: CourseRef | null;
};

export type MiniMandalaGraphInput = {
  current: CourseRef;
  intraPrev: CourseRef | null;
  intraNext: CourseRef | null;
  crossPrereqs: CourseRef[];
  crossNexts: CourseRef[];
};

/** コース ID を含むシリーズを返す */
export function findSeriesContainingCourse(
  allSeries: Series[],
  courseId: string,
): Series | undefined {
  return allSeries.find((s) => s.courses.some((c) => c.id === courseId));
}

/** シリーズ内インデックス（見つからなければ -1） */
export function getCourseIndexInSeries(
  parentSeries: Series,
  courseId: string,
): number {
  return parentSeries.courses.findIndex((c) => c.id === courseId);
}

/** 同シリーズ ID かどうか */
export function isSameSeriesCourse(
  allSeries: Series[],
  courseId: string,
  otherCourseId: string,
): boolean {
  const parent = findSeriesContainingCourse(allSeries, courseId);
  if (!parent) return false;
  return parent.courses.some((c) => c.id === otherCourseId);
}

/** 別シリーズのコース ID のみ残す */
export function filterCrossSeriesIds(
  allSeries: Series[],
  courseId: string,
  ids: string[],
): string[] {
  return ids.filter(
    (id) => id !== courseId && !isSameSeriesCourse(allSeries, courseId, id),
  );
}

/** シリーズ内の直前・直後（各0〜1） */
export function getIntraSeriesNeighbors(
  allSeries: Series[],
  courseId: string,
): IntraSeriesNeighbors {
  const parent = findSeriesContainingCourse(allSeries, courseId);
  if (!parent) return { prev: null, next: null };
  const i = getCourseIndexInSeries(parent, courseId);
  if (i < 0) return { prev: null, next: null };
  const prev =
    i > 0
      ? { id: parent.courses[i - 1].id, name: parent.courses[i - 1].name }
      : null;
  const next =
    i < parent.courses.length - 1
      ? { id: parent.courses[i + 1].id, name: parent.courses[i + 1].name }
      : null;
  return { prev, next };
}

export function resolveCourseRefs(
  allSeries: Series[],
  courseIds: string[],
): CourseRef[] {
  return courseIds.map((id) => {
    for (const s of allSeries) {
      const c = s.courses.find((co) => co.id === id);
      if (c) return { id, name: c.name };
    }
    return { id, name: id };
  });
}

/** 1コースのメタを正規化 */
export function normalizeCourseMeta(
  allSeries: Series[],
  courseId: string,
  course: Course,
): Course {
  return {
    ...course,
    prerequisites: filterCrossSeriesIds(
      allSeries,
      courseId,
      course.prerequisites,
    ),
    next_courses: filterCrossSeriesIds(
      allSeries,
      courseId,
      course.next_courses,
    ),
  };
}

/** 全シリーズのコースメタを正規化 */
export function normalizeSeriesCourseMeta(allSeries: Series[]): Series[] {
  return allSeries.map((s) => ({
    ...s,
    courses: s.courses.map((c) => normalizeCourseMeta(allSeries, c.id, c)),
  }));
}

/** 別シリーズコース選択の候補（自分・同シリーズ兄弟を除く） */
export function listCrossSeriesCourseCandidates(
  allSeries: Series[],
  courseId: string,
): Array<CourseRef & { seriesName: string }> {
  const out: Array<CourseRef & { seriesName: string }> = [];
  for (const s of allSeries) {
    for (const c of s.courses) {
      if (c.id === courseId) continue;
      if (isSameSeriesCourse(allSeries, courseId, c.id)) continue;
      out.push({ id: c.id, name: c.name, seriesName: s.name });
    }
  }
  return out;
}

/** ミニ曼陀羅用ノード集合 */
export function buildMiniMandalaGraphInput(
  allSeries: Series[],
  course: Course,
): MiniMandalaGraphInput {
  const { prev, next } = getIntraSeriesNeighbors(allSeries, course.id);
  const crossPrereqIds = filterCrossSeriesIds(
    allSeries,
    course.id,
    course.prerequisites,
  );
  const crossNextIds = filterCrossSeriesIds(
    allSeries,
    course.id,
    course.next_courses,
  );
  return {
    current: { id: course.id, name: course.name },
    intraPrev: prev,
    intraNext: next,
    crossPrereqs: resolveCourseRefs(allSeries, crossPrereqIds),
    crossNexts: resolveCourseRefs(allSeries, crossNextIds),
  };
}

/** next_courses が別シリーズ先か */
export function isCrossSeriesLink(
  allSeries: Series[],
  fromCourseId: string,
  toCourseId: string,
): boolean {
  return !isSameSeriesCourse(allSeries, fromCourseId, toCourseId);
}
