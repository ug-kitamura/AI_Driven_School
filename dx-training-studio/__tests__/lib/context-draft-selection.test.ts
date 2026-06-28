import { describe, expect, it } from "vitest";
import {
  parseReSearchQueryFromUserMessage,
  parseSearchQueryFromAssistant,
  resolveConfirmedSearchQuery,
  resolveSearchQueryRequest,
  shouldApproveSearchResults,
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

  it("resolves search query when user acknowledges keyword proposal", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "承認",
        history: [
          {
            role: "assistant",
            content: "検索キーワード: 環境構築",
          },
        ],
        lastSearchQuery: null,
        searchResultsApproved: false,
      }),
    ).toBe("環境構築");
  });

  it("does not treat initial user message as search query", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "原稿作って",
        history: [],
        lastSearchQuery: null,
        searchResultsApproved: false,
      }),
    ).toBeNull();
  });

  it("resolves keyword revision after assistant proposal", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "Git インストール",
        history: [
          {
            role: "assistant",
            content:
              "検索キーワード: Git インストール 環境構築 — このキーワードで社内コンテキストを検索します。",
          },
        ],
        lastSearchQuery: null,
        searchResultsApproved: false,
      }),
    ).toBe("Git インストール");
  });

  it("re-searches when user asks to search again with new terms", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "やっぱり Git で検索して",
        history: [],
        lastSearchQuery: "ブランチ",
        searchResultsApproved: false,
      }),
    ).toBe("Git");
  });

  it("merges additive search terms onto last query", () => {
    expect(
      parseReSearchQueryFromUserMessage("ブランチも検索対象に加えて", "Git"),
    ).toBe("Git ブランチ");
  });

  it("accepts direct 検索キーワード after initial search", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "検索キーワード: 環境構築",
        history: [],
        lastSearchQuery: "Git",
        searchResultsApproved: false,
      }),
    ).toBe("環境構築");
  });

  it("does not re-search when results are approved", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "やっぱり Git で検索して",
        history: [],
        lastSearchQuery: "ブランチ",
        searchResultsApproved: true,
      }),
    ).toBeNull();
  });

  it("approves results when user acknowledges after result table", () => {
    expect(
      shouldApproveSearchResults({
        userMessage: "ok",
        history: [
          {
            role: "assistant",
            content: "| # | タイトル |\n| 1 | foo |",
          },
        ],
        searchResultsApproved: false,
        hasSearchResults: true,
      }),
    ).toBe(true);
  });

  it("does not approve when user acknowledges new keyword proposal", () => {
    expect(
      shouldApproveSearchResults({
        userMessage: "ok",
        history: [
          {
            role: "assistant",
            content: "検索キーワード: Git — このキーワードで再検索します。",
          },
        ],
        searchResultsApproved: false,
        hasSearchResults: true,
      }),
    ).toBe(false);
  });

  it("uses last assistant keyword on ack, not older proposals", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "OK",
        history: [
          {
            role: "assistant",
            content: "検索キーワード: ブランチ",
          },
          { role: "user", content: "ok" },
          {
            role: "assistant",
            content: "| # | タイトル |",
          },
          {
            role: "assistant",
            content: "検索キーワード: Git — 再検索します。",
          },
        ],
        lastSearchQuery: "ブランチ",
        searchResultsApproved: false,
      }),
    ).toBe("Git");
  });

  it("resolveConfirmedSearchQuery remains compatible for pre-search flow", () => {
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
});
