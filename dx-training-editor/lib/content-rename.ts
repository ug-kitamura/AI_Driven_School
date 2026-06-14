import { buildCourseId, buildLessonId, buildSeriesId } from "@/lib/content-ids";
import { reconcileLesson } from "@/lib/lesson-frontmatter";
import type { Series } from "@/lib/schema";
import type { WorkspaceSelection } from "@/lib/workspace-selection";

export type IdRemap = {
  courseIds: Map<string, string>;
  lessonIds: Map<string, string>;
};

const EMPTY_REMAP: IdRemap = {
  courseIds: new Map(),
  lessonIds: new Map(),
};

export function remapSelection(
  selection: WorkspaceSelection,
  remap: IdRemap,
): WorkspaceSelection {
  return {
    courseId: remap.courseIds.get(selection.courseId) ?? selection.courseId,
    lessonId: remap.lessonIds.get(selection.lessonId) ?? selection.lessonId,
  };
}

function replaceCourseIdRefs(
  allSeries: Series[],
  courseIdRemap: Map<string, string>,
): Series[] {
  if (courseIdRemap.size === 0) return allSeries;
  return allSeries.map((s) => ({
    ...s,
    courses: s.courses.map((c) => ({
      ...c,
      prerequisites: c.prerequisites.map((id) => courseIdRemap.get(id) ?? id),
      next_courses: c.next_courses.map((id) => courseIdRemap.get(id) ?? id),
    })),
  }));
}

/** シリーズ名変更に伴い ID と曼陀羅参照を更新する */
export function applySeriesRename(
  allSeries: Series[],
  seriesId: string,
  newSeriesName: string,
): { series: Series[]; remap: IdRemap } {
  const courseIds = new Map<string, string>();
  const lessonIds = new Map<string, string>();

  const next = allSeries.map((s) => {
    if (s.id !== seriesId) return s;
    return {
      ...s,
      id: buildSeriesId(newSeriesName),
      name: newSeriesName,
      courses: s.courses.map((c) => {
        const newCourseId = buildCourseId(newSeriesName, c.name);
        courseIds.set(c.id, newCourseId);
        const ctx = { seriesName: newSeriesName, courseName: c.name };
        return {
          ...c,
          id: newCourseId,
          lessons: c.lessons.map((l) => {
            const newLessonId = buildLessonId(newSeriesName, c.name, l.lesson);
            lessonIds.set(l.id, newLessonId);
            return {
              ...reconcileLesson({ ...l, series: newSeriesName }, ctx),
              id: newLessonId,
            };
          }),
        };
      }),
    };
  });

  return {
    series: replaceCourseIdRefs(next, courseIds),
    remap: { courseIds, lessonIds },
  };
}

/** コース名変更に伴いコース・レッスン ID と曼陀羅参照を更新する（名前・本文は呼び出し側で反映済み想定） */
export function remapCourseAndLessonIds(
  allSeries: Series[],
  courseId: string,
  seriesName: string,
  newCourseName: string,
): { series: Series[]; remap: IdRemap } {
  const newCourseId = buildCourseId(seriesName, newCourseName);
  if (newCourseId === courseId) {
    return { series: allSeries, remap: EMPTY_REMAP };
  }

  const courseIds = new Map<string, string>([[courseId, newCourseId]]);
  const lessonIds = new Map<string, string>();

  const next = allSeries.map((s) => ({
    ...s,
    courses: s.courses.map((c) => {
      if (c.id !== courseId) return c;
      return {
        ...c,
        id: newCourseId,
        lessons: c.lessons.map((l) => {
          const newLessonId = buildLessonId(seriesName, newCourseName, l.lesson);
          lessonIds.set(l.id, newLessonId);
          return { ...l, id: newLessonId };
        }),
      };
    }),
  }));

  return {
    series: replaceCourseIdRefs(next, courseIds),
    remap: { courseIds, lessonIds },
  };
}
