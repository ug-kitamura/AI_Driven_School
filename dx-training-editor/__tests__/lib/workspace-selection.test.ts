import { describe, expect, it } from "vitest";
import {
  resolveSelectionAfterContentReload,
  resolveSelectionAfterDelete,
} from "@/lib/workspace-selection";
import type { Course, Lesson, Series } from "@/lib/schema";

function lesson(
  id: string,
  overrides: Partial<Lesson> = {},
): Lesson {
  return {
    id,
    series: "s",
    course: "c",
    lesson: id,
    status: "open",
    description: "",
    tags: [],
    estimated_minutes: 0,
    author: "",
    content: `---\nseries: s\ncourse: c\nlesson: ${id}\nstatus: open\ndescription: ""\ntags: []\nestimated_minutes: 0\nauthor: ""\n---\n\nbody-${id}`,
    ...overrides,
  };
}

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

describe("resolveSelectionAfterContentReload", () => {
  it("keeps selection when ids still exist in fresh series", () => {
    const data: Series[] = [
      makeSeries("s1", [course("c1", { lessons: [lesson("l1")] })]),
    ];
    expect(
      resolveSelectionAfterContentReload(data, data, {
        courseId: "c1",
        lessonId: "l1",
      }),
    ).toEqual({ courseId: "c1", lessonId: "l1" });
  });

  it("remaps lesson selection after external file rename by matching body", () => {
    const prev: Series[] = [
      makeSeries("s1", [
        course("course-A-コース", {
          name: "コース",
          lessons: [
            lesson("lesson-A-コース-旧名", {
              series: "A",
              course: "コース",
              lesson: "旧名",
              content:
                '---\nseries: A\ncourse: コース\nlesson: 旧名\nstatus: open\ndescription: ""\ntags: []\nestimated_minutes: 0\nauthor: ""\n---\n\n同じ本文',
            }),
          ],
        }),
      ]),
    ];
    const fresh: Series[] = [
      makeSeries("s1", [
        course("course-A-コース", {
          name: "コース",
          lessons: [
            lesson("lesson-A-コース-新名", {
              series: "A",
              course: "コース",
              lesson: "新名",
              content:
                '---\nseries: A\ncourse: コース\nlesson: 旧名\nstatus: open\ndescription: ""\ntags: []\nestimated_minutes: 0\nauthor: ""\n---\n\n同じ本文',
            }),
          ],
        }),
      ]),
    ];

    expect(
      resolveSelectionAfterContentReload(prev, fresh, {
        courseId: "course-A-コース",
        lessonId: "lesson-A-コース-旧名",
      }),
    ).toEqual({
      courseId: "course-A-コース",
      lessonId: "lesson-A-コース-新名",
    });
  });
});
