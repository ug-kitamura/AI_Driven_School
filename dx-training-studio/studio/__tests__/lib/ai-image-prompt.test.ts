import { describe, expect, it } from "vitest";
import { parseAiGenerationResponse } from "@/lib/ai-image-prompt";

describe("parseAiGenerationResponse", () => {
  it("parses JSON response", () => {
    const raw = JSON.stringify({
      slug: "api-flow",
      alt: "API の流れ",
      html: "<div class=\"bg-custom-surface\">x</div>",
    });
    const result = parseAiGenerationResponse(raw, "API flow");
    expect(result.slug).toBe("api-flow");
    expect(result.alt).toBe("API の流れ");
    expect(result.html).toContain("bg-custom-surface");
  });

  it("falls back to html fragment", () => {
    const raw = '<div class="p-4">diagram</div>';
    const result = parseAiGenerationResponse(raw, "My Diagram Title");
    expect(result.html).toContain("diagram");
    expect(result.slug).toBeTruthy();
    expect(result.alt).toContain("My Diagram");
  });
});
