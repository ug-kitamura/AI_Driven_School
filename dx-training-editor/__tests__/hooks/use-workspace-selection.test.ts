import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceSelection } from "@/components/workspace/hooks/use-workspace-selection";
import type { Series } from "@/lib/schema";

const series: Series[] = [
  {
    id: "s1",
    name: "Series A",
    courses: [
      {
        id: "c1",
        name: "Course 1",
        target_audience: "",
        prerequisites: [],
        next_courses: [],
        lessons: [
          {
            id: "l1",
            lesson: "Lesson 1",
            series: "Series A",
            course: "Course 1",
            status: "open",
            description: "",
            tags: [],
            estimated_minutes: 0,
            author: "",
            content: "",
          },
          {
            id: "l2",
            lesson: "Lesson 2",
            series: "Series A",
            course: "Course 1",
            status: "open",
            description: "",
            tags: [],
            estimated_minutes: 0,
            author: "",
            content: "",
          },
        ],
      },
      {
        id: "c2",
        name: "Course 2",
        target_audience: "",
        prerequisites: [],
        next_courses: [],
        lessons: [],
      },
    ],
  },
];

describe("useWorkspaceSelection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("selectCourse picks first lesson in course", () => {
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        series,
        initialCourseId: "",
        initialLessonId: "",
      }),
    );

    act(() => {
      result.current.selectCourse("c1");
    });

    expect(result.current.selectedCourseId).toBe("c1");
    expect(result.current.selectedLessonId).toBe("l1");
    expect(result.current.selectedLesson?.lesson).toBe("Lesson 1");
  });

  it("selectCourse clears lesson when course has no lessons", () => {
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        series,
        initialCourseId: "c1",
        initialLessonId: "l1",
      }),
    );

    act(() => {
      result.current.selectCourse("c2");
    });

    expect(result.current.selectedCourseId).toBe("c2");
    expect(result.current.selectedLessonId).toBe("");
  });

  it("selectLesson updates selected lesson only", () => {
    const { result } = renderHook(() =>
      useWorkspaceSelection({
        series,
        initialCourseId: "c1",
        initialLessonId: "l1",
      }),
    );

    act(() => {
      result.current.selectLesson("l2");
    });

    expect(result.current.selectedCourseId).toBe("c1");
    expect(result.current.selectedLessonId).toBe("l2");
  });
});
