import { describe, expect, it } from "vitest";
import { findCourseIdByPath } from "../lib/current-course";
import type { SiteSeries } from "../lib/site-data";

const series = [
  {
    name: "Git基礎シリーズ",
    slug: "git",
    href: "/git",
    totalMinutes: 70,
    lessonCount: 5,
    courses: [
      {
        name: "Git概念コース",
        id: "crs-concepts",
        slug: "concepts",
        href: "/git/concepts",
        crossSeriesPrev: [],
        crossSeriesNext: [],
        lessons: [],
        totalMinutes: 30,
      },
      {
        // id を持たないコース（ローダー採番前）
        name: "Git基本操作コース",
        slug: "basics",
        href: "/git/basics",
        crossSeriesPrev: [],
        crossSeriesNext: [],
        lessons: [],
        totalMinutes: 40,
      },
    ],
  },
] as unknown as SiteSeries[];

describe("findCourseIdByPath", () => {
  it("コーストップからコース ID を解く", () => {
    expect(findCourseIdByPath(series, "/git/concepts")).toBe("crs-concepts");
  });

  it("レッスンページからも同じコースを解く", () => {
    expect(findCourseIdByPath(series, "/git/concepts/three-areas")).toBe(
      "crs-concepts",
    );
  });

  it("英語ツリーでもロケールを外して解く", () => {
    expect(findCourseIdByPath(series, "/en/git/concepts")).toBe("crs-concepts");
  });

  it("全体トップでは null", () => {
    expect(findCourseIdByPath(series, "/")).toBeNull();
    expect(findCourseIdByPath(series, "/en")).toBeNull();
  });

  it("シリーズトップでは null", () => {
    expect(findCourseIdByPath(series, "/git")).toBeNull();
    expect(findCourseIdByPath(series, "/en/git")).toBeNull();
  });

  it("知らない slug では null", () => {
    expect(findCourseIdByPath(series, "/python/intro")).toBeNull();
    expect(findCourseIdByPath(series, "/git/unknown")).toBeNull();
  });

  it("id を持たないコースでは null", () => {
    expect(findCourseIdByPath(series, "/git/basics")).toBeNull();
  });
});
