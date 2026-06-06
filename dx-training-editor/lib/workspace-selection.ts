import type { Series } from "@/lib/schema";

export type WorkspaceSelection = {
  courseId: string;
  lessonId: string;
};

export type DeleteTarget =
  | { kind: "series"; seriesId: string }
  | { kind: "course"; courseId: string };

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
