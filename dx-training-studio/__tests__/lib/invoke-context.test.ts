import { describe, expect, it } from "vitest";
import { buildCreateDraftVariables } from "@/lib/agent/invoke-context";
import type { Lesson } from "@/lib/schema";

describe("buildCreateDraftVariables", () => {
  const lesson: Lesson = {
    id: "1",
    series: "シリーズ",
    course: "コース",
    lesson: "レッスン",
    status: "open",
    description: "説明",
    tags: [],
    estimated_minutes: 10,
    author: "author",
    content: "---\nseries: シリーズ\n---\n\n本文",
  };

  it("includes contextItems with default empty array", () => {
    const variables = buildCreateDraftVariables({
      lesson,
      lessonBody: "本文",
      courseMeta: { name: "コース" },
    });
    expect(variables.contextItems).toBe("[]");
  });

  it("passes provided contextItems JSON", () => {
    const contextItems = JSON.stringify([{ id: 1, title: "A" }], null, 2);
    const variables = buildCreateDraftVariables({
      lesson,
      lessonBody: "本文",
      courseMeta: { name: "コース" },
      contextItems,
    });
    expect(variables.contextItems).toBe(contextItems);
  });
});
