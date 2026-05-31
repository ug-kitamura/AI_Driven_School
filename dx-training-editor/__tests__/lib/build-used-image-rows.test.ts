import { describe, expect, it } from "vitest";
import { buildUsedImageRows } from "@/lib/build-used-image-rows";
import type { ImageFileEntry } from "@/lib/image-store";

describe("buildUsedImageRows", () => {
  it("merges promoted files with missing refs", () => {
    const promoted: ImageFileEntry[] = [
      {
        path: "images/uploaded/a.png",
        name: "a.png",
        source: "uploaded",
        uploadedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const refCounts = new Map([
      ["images/uploaded/a.png", 2],
      ["images/uploaded/missing.png", 1],
    ]);
    const rows = buildUsedImageRows(promoted, refCounts);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.path === "images/uploaded/a.png")).toMatchObject({
      referenceCount: 2,
      missing: false,
    });
    expect(rows.find((r) => r.path === "images/uploaded/missing.png")).toMatchObject({
      referenceCount: 1,
      missing: true,
    });
  });
});
