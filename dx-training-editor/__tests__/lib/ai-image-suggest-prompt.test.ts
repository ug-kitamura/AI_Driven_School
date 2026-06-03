import { describe, expect, it } from "vitest";
import {
  parseSuggestPromptResponse,
  snippetAroundOffset,
} from "@/lib/ai-image-suggest-prompt";

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
