import { describe, expect, it } from "vitest";
import {
  applyContextSelection,
  parseContextSelection,
  parseSearchQueryFromAssistant,
  resolveConfirmedSearchQuery,
} from "@/lib/context-draft-selection";

describe("context-draft-selection", () => {
  it("parses search query from assistant message", () => {
    expect(parseSearchQueryFromAssistant("検索キーワード: ブランチ戦略")).toBe(
      "ブランチ戦略",
    );
  });

  it("strips trailing explanation after em dash", () => {
    expect(
      parseSearchQueryFromAssistant(
        "検索キーワード: Git インストール 環境構築 — このキーワードで社内コンテキストを検索します。",
      ),
    ).toBe("Git インストール 環境構築");
  });

  it("strips trailing explanation after spaced hyphen", () => {
    expect(
      parseSearchQueryFromAssistant(
        "検索キーワード: Git インストール - このキーワードで社内コンテキストを検索します。",
      ),
    ).toBe("Git インストール");
  });

  it("resolves search query when user acknowledges", () => {
    expect(
      resolveConfirmedSearchQuery({
        userMessage: "承認",
        history: [
          {
            role: "assistant",
            content: "検索キーワード: 環境構築",
          },
        ],
      }),
    ).toBe("環境構築");
  });

  it("does not treat initial user message as search query", () => {
    expect(
      resolveConfirmedSearchQuery({
        userMessage: "原稿作って",
        history: [],
      }),
    ).toBeNull();
  });

  it("resolves keyword revision after assistant proposal", () => {
    expect(
      resolveConfirmedSearchQuery({
        userMessage: "Git インストール",
        history: [
          {
            role: "assistant",
            content:
              "検索キーワード: Git インストール 環境構築 — このキーワードで社内コンテキストを検索します。",
          },
        ],
      }),
    ).toBe("Git インストール");
  });

  it("resolves OK as acknowledgement", () => {
    expect(
      resolveConfirmedSearchQuery({
        userMessage: "OK",
        history: [
          {
            role: "assistant",
            content: "検索キーワード: Git インストール",
          },
        ],
      }),
    ).toBe("Git インストール");
  });

  it("parses comma-separated selection", () => {
    expect(parseContextSelection("1,3", 3)).toEqual([1, 3]);
  });

  it("parses all selection", () => {
    expect(parseContextSelection("all", 3)).toBe("all");
    expect(applyContextSelection([{ id: 1 }, { id: 2 }], "all")).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it("parses none selection", () => {
    expect(parseContextSelection("0", 3)).toBe("none");
    expect(applyContextSelection([{ id: 1 }], "none")).toEqual([]);
  });

  it("returns null for unrelated message during selection", () => {
    expect(parseContextSelection("もう少し詳しく", 3)).toBeNull();
  });
});
