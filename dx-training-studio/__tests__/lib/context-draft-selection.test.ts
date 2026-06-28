import { describe, expect, it } from "vitest";
import {
  applyContextSelection,
  parseContextSelectionIntent,
  parseSearchQueryFromAssistant,
  resolveConfirmedSearchQuery,
} from "@/lib/context-draft-selection";

describe("context-draft-selection", () => {
  it("parses search query from assistant message", () => {
    expect(parseSearchQueryFromAssistant("検索キーワード: ブランチ戦略")).toBe(
      "ブランチ戦略",
    );
  });

  it("strips quotes from assistant keyword proposal", () => {
    expect(parseSearchQueryFromAssistant("検索キーワード: 「ブランチ」")).toBe(
      "ブランチ",
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

  it("resolves OK as acknowledgement with quoted keyword", () => {
    expect(
      resolveConfirmedSearchQuery({
        userMessage: "OK",
        history: [
          {
            role: "assistant",
            content: "検索キーワード: 「ブランチ」 — このキーワードで検索します。",
          },
        ],
      }),
    ).toBe("ブランチ");
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
    expect(parseContextSelectionIntent("1,3", 3)).toEqual([1, 3]);
    expect(parseContextSelectionIntent("1と2", 3)).toEqual([1, 2]);
  });

  it("parses all selection including natural Japanese", () => {
    expect(parseContextSelectionIntent("all", 3)).toBe("all");
    expect(parseContextSelectionIntent("やっぱり全部参照して", 2)).toBe("all");
    expect(parseContextSelectionIntent("全部使って", 2)).toBe("all");
    expect(applyContextSelection([{ id: 1 }, { id: 2 }], "all")).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it("parses single-number revision", () => {
    expect(parseContextSelectionIntent("やっぱり１にして", 3)).toEqual([1]);
    expect(parseContextSelectionIntent("2だけ", 3)).toEqual([2]);
  });

  it("parses none selection including natural Japanese", () => {
    expect(parseContextSelectionIntent("0", 3)).toBe("none");
    expect(parseContextSelectionIntent("参照しなくていいや", 3)).toBe("none");
    expect(parseContextSelectionIntent("使わなくていい", 3)).toBe("none");
    expect(parseContextSelectionIntent("不要", 3)).toBe("none");
    expect(applyContextSelection([{ id: 1 }], "none")).toEqual([]);
  });

  it("prefers none over all when user rejects all items", () => {
    expect(parseContextSelectionIntent("全部いらない", 3)).toBe("none");
  });

  it("returns null for unrelated message during selection", () => {
    expect(parseContextSelectionIntent("もう少し詳しく", 3)).toBeNull();
  });
});
