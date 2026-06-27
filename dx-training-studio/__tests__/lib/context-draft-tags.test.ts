import { describe, expect, it } from "vitest";
import {
  parseTagsFromBracketFormat,
  resolveConfirmedCreateDraftTags,
} from "@/lib/context-draft-tags";

describe("context-draft-tags", () => {
  it("parses bracket tag format", () => {
    expect(parseTagsFromBracketFormat("候補: [環境構築, セキュリティ]")).toEqual([
      "環境構築",
      "セキュリティ",
    ]);
  });

  it("uses user bracket tags when provided", () => {
    expect(
      resolveConfirmedCreateDraftTags({
        userMessage: "[xyz, 環境構築]",
        history: [],
      }),
    ).toEqual(["xyz", "環境構築"]);
  });

  it("uses assistant tags when user acknowledges", () => {
    expect(
      resolveConfirmedCreateDraftTags({
        userMessage: "承認",
        history: [
          {
            role: "assistant",
            content: "候補: [環境構築, セキュリティ]",
          },
        ],
      }),
    ).toEqual(["環境構築", "セキュリティ"]);
  });

  it("returns null when tags are not confirmed", () => {
    expect(
      resolveConfirmedCreateDraftTags({
        userMessage: "もう少し詳しく",
        history: [
          {
            role: "assistant",
            content: "候補: [環境構築]",
          },
        ],
      }),
    ).toBeNull();
  });
});
