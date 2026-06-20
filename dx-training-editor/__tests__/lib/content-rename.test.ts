import { describe, expect, it } from "vitest";
import {
  applySeriesRename,
  remapCourseAndLessonIds,
  remapSelection,
} from "@/lib/content-rename";
import type { Series } from "@/lib/schema";

const initial: Series[] = [
  {
    id: "series-シリーズA",
    name: "シリーズA",
    courses: [
      {
        id: "course-シリーズA-コース1",
        name: "コース1",
        target: "",
        prerequisites: ["course-シリーズB-コースX"],
        next_courses: [],
        lessons: [
          {
            id: "lesson-シリーズA-コース1-レッスン1",
            series: "シリーズA",
            course: "コース1",
            lesson: "レッスン1",
            status: "open",
            description: "",
            tags: [],
            estimated_minutes: 0,
            author: "",
            content: "",
          },
        ],
      },
    ],
  },
  {
    id: "series-シリーズB",
    name: "シリーズB",
    courses: [
      {
        id: "course-シリーズB-コースX",
        name: "コースX",
        target: "",
        prerequisites: [],
        next_courses: ["course-シリーズA-コース1"],
        lessons: [],
      },
    ],
  },
];

describe("applySeriesRename", () => {
  it("remaps series, course, lesson ids and cross-series refs", () => {
    const { series, remap } = applySeriesRename(
      initial,
      "series-シリーズA",
      "シリーズA改",
    );

    expect(series[0].id).toBe("series-シリーズA改");
    expect(series[0].courses[0].id).toBe("course-シリーズA改-コース1");
    expect(series[0].courses[0].lessons[0].id).toBe(
      "lesson-シリーズA改-コース1-レッスン1",
    );
    expect(series[1].courses[0].next_courses).toEqual([
      "course-シリーズA改-コース1",
    ]);
    expect(series[0].courses[0].prerequisites).toEqual([
      "course-シリーズB-コースX",
    ]);

    expect(
      remapSelection(
        {
          courseId: "course-シリーズA-コース1",
          lessonId: "lesson-シリーズA-コース1-レッスン1",
        },
        remap,
      ),
    ).toEqual({
      courseId: "course-シリーズA改-コース1",
      lessonId: "lesson-シリーズA改-コース1-レッスン1",
    });
  });
});

describe("remapCourseAndLessonIds", () => {
  it("remaps course and lesson ids and cross-series refs", () => {
    const { series, remap } = remapCourseAndLessonIds(
      initial,
      "course-シリーズA-コース1",
      "シリーズA",
      "コース1改",
    );

    expect(series[0].courses[0].id).toBe("course-シリーズA-コース1改");
    expect(series[0].courses[0].lessons[0].id).toBe(
      "lesson-シリーズA-コース1改-レッスン1",
    );
    expect(series[1].courses[0].next_courses).toEqual([
      "course-シリーズA-コース1改",
    ]);

    expect(
      remapSelection(
        {
          courseId: "course-シリーズA-コース1",
          lessonId: "lesson-シリーズA-コース1-レッスン1",
        },
        remap,
      ),
    ).toEqual({
      courseId: "course-シリーズA-コース1改",
      lessonId: "lesson-シリーズA-コース1改-レッスン1",
    });
  });
});
