import { describe, expect, it } from "vitest";
import { buildImageGenerationMessages, parseAiGenerationResponse } from "@/lib/ai-image-prompt";
import type { Lesson } from "@/lib/schema";

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

describe("buildImageGenerationMessages の lesson 任意化", () => {
  const lesson: Lesson = {
    id: "l1",
    series: "s",
    course: "c",
    lesson: "Git 入門",
    status: "open",
    description: "バージョン管理の基礎",
    tags: ["git"],
    estimated_minutes: 10,
    author: "",
    content: "本文サンプル",
  };

  it("lesson があればレッスン文脈と本文全文を含める", () => {
    const { user } = buildImageGenerationMessages(lesson, "4 ステップのフロー");
    expect(user).toContain("4 ステップのフロー");
    expect(user).toContain("## Lesson context");
    expect(user).toContain("Git 入門");
    expect(user).toContain("## Full lesson markdown body");
    expect(user).toContain("本文サンプル");
  });

  it("lesson が無ければ文脈ブロックを含めず著者プロンプトだけを渡す", () => {
    const { user } = buildImageGenerationMessages(undefined, "4 ステップのフロー");
    expect(user).toContain("4 ステップのフロー");
    expect(user).not.toContain("## Lesson context");
    expect(user).not.toContain("## Full lesson markdown body");
  });
});
