import { describe, expect, it } from "vitest";
import { resolveSelectionAfterDelete } from "@/lib/workspace-selection";
import type { Course, Series } from "@/lib/schema";

function course(id: string, overrides: Partial<Course> = {}): Course {
  return {
    id,
    name: id,
    target_audience: "",
    prerequisites: [],
    next_courses: [],
    lessons: [],
    ...overrides,
  };
}

function makeSeries(id: string, courses: Course[]): Series {
  return { id, name: id, courses };
}

const sampleSeries: Series[] = [
  makeSeries("s1", [
    course("c1", {
      lessons: [{ id: "l1", lesson: "L1" } as Course["lessons"][number]],
    }),
    course("c2", {
      lessons: [{ id: "l2", lesson: "L2" } as Course["lessons"][number]],
    }),
  ]),
  makeSeries("s2", [
    course("c3", {
      lessons: [{ id: "l3", lesson: "L3" } as Course["lessons"][number]],
    }),
  ]),
];

describe("resolveSelectionAfterDelete", () => {
  it("falls back to first course when deleting series containing selected course", () => {
    const next = sampleSeries.filter((s) => s.id !== "s1");
    expect(
      resolveSelectionAfterDelete({
        prevSeries: sampleSeries,
        nextSeries: next,
        selectedCourseId: "c1",
        selectedLessonId: "l1",
        deleted: { kind: "series", seriesId: "s1" },
      }),
    ).toEqual({ courseId: "c3", lessonId: "l3" });
  });

  it("keeps selection when deleting non-selected series", () => {
    const next = sampleSeries.filter((s) => s.id !== "s2");
    expect(
      resolveSelectionAfterDelete({
        prevSeries: sampleSeries,
        nextSeries: next,
        selectedCourseId: "c1",
        selectedLessonId: "l1",
        deleted: { kind: "series", seriesId: "s2" },
      }),
    ).toEqual({ courseId: "c1", lessonId: "l1" });
  });

  it("falls back when deleting selected course", () => {
    const next: Series[] = [
      makeSeries("s1", [sampleSeries[0].courses[1]]),
      sampleSeries[1],
    ];
    expect(
      resolveSelectionAfterDelete({
        prevSeries: sampleSeries,
        nextSeries: next,
        selectedCourseId: "c1",
        selectedLessonId: "l1",
        deleted: { kind: "course", courseId: "c1" },
      }),
    ).toEqual({ courseId: "c2", lessonId: "l2" });
  });

  it("keeps selection when deleting non-selected course", () => {
    const next: Series[] = [
      makeSeries("s1", [sampleSeries[0].courses[0]]),
      sampleSeries[1],
    ];
    expect(
      resolveSelectionAfterDelete({
        prevSeries: sampleSeries,
        nextSeries: next,
        selectedCourseId: "c1",
        selectedLessonId: "l1",
        deleted: { kind: "course", courseId: "c2" },
      }),
    ).toEqual({ courseId: "c1", lessonId: "l1" });
  });
});
