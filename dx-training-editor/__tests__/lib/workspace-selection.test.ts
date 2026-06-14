import { beforeEach, describe, expect, it } from "vitest";
import {
  resolveSelectionAfterContentReload,
  resolveSelectionAfterDelete,
  resolveInitialSelection,
  saveStoredSelection,
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

describe("resolveInitialSelection", () => {
  const series: Series[] = [
    makeSeries("s1", [
      course("c1", {
        name: "Course 1",
        lessons: [lesson("l1"), lesson("l2")],
      }),
      course("c2", { name: "Course 2", lessons: [lesson("l3")] }),
    ]),
  ];

  const fallback = { courseId: "c1", lessonId: "l1" };

  beforeEach(() => {
    localStorage.clear();
  });

  it("returns fallback when nothing is stored", () => {
    expect(resolveInitialSelection(series, fallback)).toEqual(fallback);
  });

  it("restores stored lesson selection", () => {
    saveStoredSelection({ courseId: "c1", lessonId: "l2" });
    expect(resolveInitialSelection(series, fallback)).toEqual({
      courseId: "c1",
      lessonId: "l2",
    });
  });

  it("falls back to first lesson when stored lesson is missing", () => {
    saveStoredSelection({ courseId: "c1", lessonId: "missing" });
    expect(resolveInitialSelection(series, fallback)).toEqual({
      courseId: "c1",
      lessonId: "l1",
    });
  });

  it("returns fallback when stored course is missing", () => {
    saveStoredSelection({ courseId: "missing", lessonId: "l1" });
    expect(resolveInitialSelection(series, fallback)).toEqual(fallback);
  });
});
