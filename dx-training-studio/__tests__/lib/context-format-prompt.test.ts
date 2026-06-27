import { describe, expect, it } from "vitest";
import {
  buildContextFormatMessages,
  parseContextFormatResponse,
} from "@/lib/context-format-prompt";

describe("context-format-prompt", () => {
  it("builds messages with existing tags", () => {
    const { system, user } = buildContextFormatMessages("原文テキスト", [
      "環境構築",
    ]);
    expect(system).toContain("創作禁止");
    expect(user).toContain("原文テキスト");
    expect(user).toContain("環境構築");
  });

  it("parses JSON response", () => {
    const parsed = parseContextFormatResponse(
      '{"body":"# 見出し\\n本文","suggestedTags":["環境構築","xyz"]}',
    );
    expect(parsed).toEqual({
      body: "# 見出し\n本文",
      suggestedTags: ["環境構築", "xyz"],
    });
  });

  it("returns null for invalid response", () => {
    expect(parseContextFormatResponse("not-json")).toBeNull();
  });
});
