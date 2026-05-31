import { describe, it, expect } from "vitest";
import { applyCrossSeriesCourseMetaEdit } from "@/lib/course-flow";
import type { Course, Series } from "@/lib/schema";

function course(id: string, overrides: Partial<Course> = {}): Course {
  return {
    id,
    name: id,
    prerequisites: [],
    next_courses: [],
    lessons: [],
    ...overrides,
  };
}

function series(id: string, courses: Course[]): Series {
  return { id, name: id, courses };
}

function getCourse(allSeries: Series[], id: string): Course {
  const found = allSeries.flatMap((s) => s.courses).find((c) => c.id === id);
  if (!found) throw new Error(`course not found: ${id}`);
  return found;
}

describe("applyCrossSeriesCourseMetaEdit", () => {
  it("reassigns cross-series exit from A2 to A1 via next_courses edit", () => {
    const initial = [
      series("sa", [
        course("a1"),
        course("a2", { next_courses: ["b1"] }),
      ]),
      series("sb", [course("b1", { prerequisites: ["a2"] })]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "a1", [], ["b1"]);

    expect(getCourse(result, "a1").next_courses).toEqual(["b1"]);
    expect(getCourse(result, "a2").next_courses).toEqual([]);
    expect(getCourse(result, "b1").prerequisites).toEqual(["a1"]);
  });

  it("keeps other source series when reassigning within series A", () => {
    const initial = [
      series("sa", [
        course("a1", { next_courses: ["b2"] }),
        course("a2"),
      ]),
      series("sb", [
        course("b1", { next_courses: ["b2"] }),
        course("b2", { prerequisites: ["a1", "b1"] }),
      ]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "a2", [], ["b2"]);

    expect(getCourse(result, "a2").next_courses).toEqual(["b2"]);
    expect(getCourse(result, "a1").next_courses).toEqual([]);
    expect(getCourse(result, "b1").next_courses).toEqual(["b2"]);
    expect(getCourse(result, "b2").prerequisites).toEqual(
      expect.arrayContaining(["a2", "b1"]),
    );
    expect(getCourse(result, "b2").prerequisites).toHaveLength(2);
  });

  it("syncs prerequisites-side edit and mirrors to source next_courses", () => {
    const initial = [
      series("sa", [
        course("a1"),
        course("a2", { next_courses: ["b1"] }),
      ]),
      series("sb", [course("b1", { prerequisites: ["a2"] })]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "b1", ["a1"], []);

    expect(getCourse(result, "a1").next_courses).toEqual(["b1"]);
    expect(getCourse(result, "a2").next_courses).toEqual([]);
    expect(getCourse(result, "b1").prerequisites).toEqual(["a1"]);
  });

  it("removes mirror links when cross-series next is cleared", () => {
    const initial = [
      series("sa", [course("a1", { next_courses: ["b1"] })]),
      series("sb", [course("b1", { prerequisites: ["a1"] })]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "a1", [], []);

    expect(getCourse(result, "a1").next_courses).toEqual([]);
    expect(getCourse(result, "b1").prerequisites).toEqual([]);
  });

  it("drops prior next in same target series when prereq is reassigned", () => {
    const initial = [
      series("sa", [
        course("a1", { next_courses: ["b1"] }),
        course("a2", { next_courses: ["b2"] }),
      ]),
      series("sb", [
        course("b1", { prerequisites: ["a1"] }),
        course("b2", { prerequisites: ["a2"] }),
      ]),
    ];

    const result = applyCrossSeriesCourseMetaEdit(initial, "b2", ["a1"], []);

    expect(getCourse(result, "a1").next_courses).toEqual(["b2"]);
    expect(getCourse(result, "a2").next_courses).toEqual([]);
    expect(getCourse(result, "b1").prerequisites).toEqual([]);
    expect(getCourse(result, "b2").prerequisites).toEqual(["a1"]);
  });
});
