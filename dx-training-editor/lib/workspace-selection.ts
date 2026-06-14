import type { Series } from "@/lib/schema";
import { parseLessonDocument } from "@/lib/lesson-frontmatter";

export type WorkspaceSelection = {
  courseId: string;
  lessonId: string;
};

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
  const { courseId, lessonId } = selection;

  if (lessonId && findLessonById(freshSeries, lessonId)) {
    const course = findCourseContainingLesson(freshSeries, lessonId);
    return { courseId: course?.id ?? courseId, lessonId };
  }

  const prevLesson = lessonId ? findLessonById(prevSeries, lessonId) : undefined;
  if (prevLesson) {
    const body = lessonBody(prevLesson.content);
    for (const s of freshSeries) {
      for (const c of s.courses) {
        for (const l of c.lessons) {
          if (lessonBody(l.content) === body) {
            return { courseId: c.id, lessonId: l.id };
          }
        }
      }
    }
  }

  if (courseId && findCourseById(freshSeries, courseId)) {
    return { courseId, lessonId: "" };
  }

  const prevCourse = courseId ? findCourseById(prevSeries, courseId) : undefined;
  if (prevCourse) {
    for (const s of freshSeries) {
      const c = s.courses.find((co) => co.name === prevCourse.name);
      if (c) {
        return { courseId: c.id, lessonId: "" };
      }
    }
  }

  return selection;
}

function firstCourseSelection(nextSeries: Series[]): WorkspaceSelection {
  const firstCourse = nextSeries.flatMap((s) => s.courses)[0];
  return {
    courseId: firstCourse?.id ?? "",
    lessonId: firstCourse?.lessons[0]?.id ?? "",
  };
}

export function resolveSelectionAfterDelete(params: {
  prevSeries: Series[];
  nextSeries: Series[];
  selectedCourseId: string;
  selectedLessonId: string;
  deleted: DeleteTarget;
}): WorkspaceSelection {
  const { prevSeries, nextSeries, selectedCourseId, selectedLessonId, deleted } =
    params;

  if (deleted.kind === "series") {
    const removed = prevSeries.find((s) => s.id === deleted.seriesId);
    const hadSelectedCourse =
      removed?.courses.some((c) => c.id === selectedCourseId) ?? false;
    if (hadSelectedCourse) {
      return firstCourseSelection(nextSeries);
    }
    return { courseId: selectedCourseId, lessonId: selectedLessonId };
  }

  if (selectedCourseId === deleted.courseId) {
    return firstCourseSelection(nextSeries);
  }
  return { courseId: selectedCourseId, lessonId: selectedLessonId };
}
