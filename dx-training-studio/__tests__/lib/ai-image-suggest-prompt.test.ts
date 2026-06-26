import { describe, expect, it } from "vitest";
import {
  buildSuggestPromptMessages,
  parseSuggestPromptResponse,
  snippetAroundOffset,
} from "@/lib/ai-image-suggest-prompt";
import type { Lesson } from "@/lib/schema";

const lesson: Lesson = {
  id: "l1",
  lesson: "Test",
  status: "open",
  description: "desc",
  tags: ["tag"],
  estimatedMinutes: 10,
  author: "author",
  content: "---\nlesson: Test\n---\n\nbody",
};

describe("snippetAroundOffset", () => {
  it("extracts text around offset with ellipsis", () => {
    const text = "aaaaBBBBcccc";
    expect(snippetAroundOffset(text, 6, 4)).toBe("…aaBBBBcc…");
  });
});

describe("parseSuggestPromptResponse", () => {
  it("returns plain text", () => {
    expect(parseSuggestPromptResponse("  flow diagram  ")).toBe("flow diagram");
  });

  it("strips markdown fences", () => {
    expect(parseSuggestPromptResponse("```\nstep flow\n```")).toBe("step flow");
  });
});

describe("buildSuggestPromptMessages", () => {
  it("includes seed prompt when provided", () => {
    const { user } = buildSuggestPromptMessages(lesson, 0, "seed text");
    expect(user).toContain("Seed prompt");
    expect(user).toContain("seed text");
  });
});
