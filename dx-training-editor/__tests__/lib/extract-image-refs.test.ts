import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/schema";
import {
  FILTER_SERIES_UNUSED,
  indexImageRefLocations,
  isUsedImageFilterActive,
  usedRowMatchesFilter,
  type UsedImageFilter,
} from "@/lib/extract-image-refs";

const seriesFixture: Series[] = [
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
            status: "open",
            description: "",
            tags: [],
            estimatedMinutes: 0,
            author: "",
            content: "![a](images/used.png)\n",
          },
          {
            id: "l2",
            lesson: "Lesson 2",
            status: "open",
            description: "",
            tags: [],
            estimatedMinutes: 0,
            author: "",
            content: "no images",
          },
        ],
      },
    ],
  },
];

describe("usedRowMatchesFilter", () => {
  const refLocations = indexImageRefLocations(seriesFixture);

  it("shows all rows when filter inactive", () => {
    const filter: UsedImageFilter = {
      seriesId: null,
      courseId: null,
      lessonId: null,
    };
    expect(isUsedImageFilterActive(filter)).toBe(false);
    expect(
      usedRowMatchesFilter("images/used.png", 1, filter, refLocations),
    ).toBe(true);
    expect(
      usedRowMatchesFilter("images/unused.png", 0, filter, refLocations),
    ).toBe(true);
  });

  it("hides unused when filter active", () => {
    const filter: UsedImageFilter = {
      seriesId: "s1",
      courseId: null,
      lessonId: null,
    };
    expect(
      usedRowMatchesFilter("images/unused.png", 0, filter, refLocations),
    ).toBe(false);
  });

  it("series unused mode shows only unreferenced images", () => {
    const filter: UsedImageFilter = {
      seriesId: FILTER_SERIES_UNUSED,
      courseId: null,
      lessonId: null,
    };
    expect(isUsedImageFilterActive(filter)).toBe(true);
    expect(
      usedRowMatchesFilter("images/used.png", 1, filter, refLocations),
    ).toBe(false);
    expect(
      usedRowMatchesFilter("images/unused.png", 0, filter, refLocations),
    ).toBe(true);
  });

  it("matches lesson scope", () => {
    const filter: UsedImageFilter = {
      seriesId: "s1",
      courseId: "c1",
      lessonId: "l1",
    };
    expect(
      usedRowMatchesFilter("images/used.png", 1, filter, refLocations),
    ).toBe(true);
    expect(
      usedRowMatchesFilter("images/other.png", 1, filter, refLocations),
    ).toBe(false);
  });
});
