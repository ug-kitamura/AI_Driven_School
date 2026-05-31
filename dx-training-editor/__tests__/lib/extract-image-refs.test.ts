import { describe, expect, it } from "vitest";
import { countImageRefsInSeries, extractImageRefs } from "@/lib/extract-image-refs";
import type { Series } from "@/lib/schema";

describe("extractImageRefs", () => {
  it("extracts images paths from markdown", () => {
    const content = [
      "text",
      "![a](images/uploaded/a.png)",
      "![b](images/ai/b.png)",
      "![data](data:image/png;base64,abc)",
      "![ext](https://example.com/x.png)",
    ].join("\n");
    expect(extractImageRefs(content)).toEqual([
      "images/uploaded/a.png",
      "images/ai/b.png",
    ]);
  });
});

describe("countImageRefsInSeries", () => {
  it("counts occurrences across lessons", () => {
    const series: Series[] = [
      {
        id: "s1",
        name: "S",
        courses: [
          {
            id: "c1",
            name: "C",
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
                content: "![a](images/uploaded/a.png)",
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
                content: "![a](images/uploaded/a.png)\n![b](images/uploaded/b.png)",
              },
            ],
            prerequisites: [],
            next_courses: [],
          },
        ],
      },
    ];
    const counts = countImageRefsInSeries(series);
    expect(counts.get("images/uploaded/a.png")).toBe(2);
    expect(counts.get("images/uploaded/b.png")).toBe(1);
  });
});
