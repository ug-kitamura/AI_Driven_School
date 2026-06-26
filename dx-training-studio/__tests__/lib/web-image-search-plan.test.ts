import { describe, expect, it } from "vitest";
import { parseWebSearchPlanResponse } from "@/lib/web-image-search-plan";

describe("parseWebSearchPlanResponse", () => {
  it("parses valid JSON plan", () => {
    const plan = parseWebSearchPlanResponse(
      JSON.stringify({
        queries: [
          { q: "office meeting", media: "photo" },
          { q: "teamwork flat", media: "illustration" },
        ],
      }),
    );
    expect(plan.queries).toHaveLength(2);
    expect(plan.queries[0]).toEqual({ q: "office meeting", media: "photo" });
  });

  it("caps queries at three", () => {
    const plan = parseWebSearchPlanResponse(
      JSON.stringify({
        queries: [
          { q: "a", media: "photo" },
          { q: "b", media: "photo" },
          { q: "c", media: "photo" },
          { q: "d", media: "photo" },
        ],
      }),
    );
    expect(plan.queries).toHaveLength(3);
  });

  it("strips markdown fences", () => {
    const plan = parseWebSearchPlanResponse(
      '```json\n{"queries":[{"q":"laptop work","media":"photo"}]}\n```',
    );
    expect(plan.queries[0].q).toBe("laptop work");
  });

  it("throws on invalid media", () => {
    expect(() =>
      parseWebSearchPlanResponse(
        JSON.stringify({ queries: [{ q: "test", media: "vector" }] }),
      ),
    ).toThrow("no valid queries");
  });

  it("throws on empty queries", () => {
    expect(() =>
      parseWebSearchPlanResponse(JSON.stringify({ queries: [] })),
    ).toThrow("no queries");
  });
});
