import { describe, expect, it } from "vitest";
import {
  countImageRefsInSeries,
  extractImageRefs,
} from "@/lib/extract-image-refs";
import type { Series } from "@/lib/schema";

describe("extractImageRefs", () => {
  it("extracts canonical image paths only", () => {
    const content = [
      "![a](images/a.png)",
      "![b](images/b.png)",
      "![legacy](images/uploaded/legacy.png)",
    ].join("\n");
    expect(extractImageRefs(content)).toEqual([
      "images/a.png",
      "images/b.png",
    ]);
  });
});

describe("countImageRefsInSeries", () => {
  it("counts refs across lessons", () => {
    const series: Series[] = [
      {
        id: "s1",
        name: "S",
        courses: [
          {
            id: "c1",
            name: "C",
            prerequisites: [],
            next_courses: [],
            lessons: [
              {
                id: "l1",
                series: "S",
                course: "C",
                lesson: "L1",
                status: "open",
                description: "",
                tags: [],
                estimated_minutes: 0,
                author: "",
                content: "![a](images/foo.png)",
              },
              {
                id: "l2",
                series: "S",
                course: "C",
                lesson: "L2",
                status: "open",
                description: "",
                tags: [],
                estimated_minutes: 0,
                author: "",
                content: "![a](images/foo.png)\n![b](images/bar.png)",
              },
            ],
          },
        ],
      },
    ];
    const counts = countImageRefsInSeries(series);
    expect(counts.get("images/foo.png")).toBe(2);
    expect(counts.get("images/bar.png")).toBe(1);
  });
});
