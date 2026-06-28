import { describe, expect, it } from "vitest";
import {
  applySelectionConfirm,
  parseSelectionConfirmLine,
  parseSearchKeywordLine,
  parseSearchQueryFromAssistant,
  resolveConfirmedSearchQuery,
  resolveContextItemsForInvoke,
  resolveSearchQueryRequest,
  resolveSelectionConfirmUpdate,
  SEARCH_RESULTS_APPROVED_LINE,
  shouldApproveSearchResults,
  shouldAutoContinueAfterCreateDraftAssistant,
} from "@/lib/context-draft-selection";

describe("context-draft-selection", () => {
  it("parses search keyword line from assistant message", () => {
    expect(parseSearchKeywordLine("検索キーワード: ブランチ戦略")).toBe(
      "ブランチ戦略",
    );
    expect(parseSearchQueryFromAssistant("検索キーワード: ブランチ戦略")).toBe(
      "ブランチ戦略",
    );
  });

  it("strips quotes from keyword line", () => {
    expect(parseSearchKeywordLine("検索キーワード: 「ブランチ」")).toBe("ブランチ");
  });

  it("runs search when user sends keyword line directly", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "検索キーワード: 環境構築",
        history: [],
        searchResultsApproved: false,
      }),
    ).toBe("環境構築");
  });

  it("runs search when user acks last assistant keyword proposal", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "承認",
        history: [
          {
            role: "assistant",
            content: "検索キーワード: 環境構築",
          },
        ],
        searchResultsApproved: false,
      }),
    ).toBe("環境構築");
  });

  it("runs search when user sends casual Japanese approval", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "まぁいいかな",
        history: [
          {
            role: "assistant",
            content: "検索キーワード: git config",
          },
        ],
        searchResultsApproved: false,
      }),
    ).toBe("git config");
  });

  it("does not parse natural language re-search requests", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "やっぱり Git で検索して",
        history: [],
        searchResultsApproved: false,
      }),
    ).toBeNull();
    expect(
      resolveSearchQueryRequest({
        userMessage: "ブランチも検索対象に加えて",
        history: [],
        searchResultsApproved: false,
      }),
    ).toBeNull();
  });

  it("does not parse free-text keyword revision without protocol line", () => {
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
        searchResultsApproved: false,
      }),
    ).toBeNull();
  });

  it("does not search after results are approved", () => {
    expect(
      resolveSearchQueryRequest({
        userMessage: "検索キーワード: Git",
        history: [],
        searchResultsApproved: true,
      }),
    ).toBeNull();
  });

  it("approves results on ack when last assistant has no keyword line", () => {
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

  it("approves results on explicit protocol line", () => {
    expect(
      shouldApproveSearchResults({
        userMessage: SEARCH_RESULTS_APPROVED_LINE,
        history: [],
        searchResultsApproved: false,
        hasSearchResults: true,
      }),
    ).toBe(true);
  });

  it("does not approve when user acks a new keyword proposal", () => {
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

  it("uses keyword from last assistant only on ack", () => {
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
        searchResultsApproved: false,
      }),
    ).toBe("Git");
  });

  it("resolveConfirmedSearchQuery delegates to resolveSearchQueryRequest", () => {
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

describe("selection confirm protocol", () => {
  const items = [
    { id: 1, title: "A", body: "body-a", source_url: "https://a.example" },
    { id: 2, title: "B", body: "body-b", source_url: "https://b.example" },
  ] as const;

  it("parses selection confirm line", () => {
    expect(parseSelectionConfirmLine("選択確定: 1,3")).toEqual([1, 3]);
    expect(parseSelectionConfirmLine("選択確定: all")).toBe("all");
    expect(parseSelectionConfirmLine("選択確定: none")).toBe("none");
  });

  it("applies selection to items", () => {
    expect(applySelectionConfirm([...items], [2])).toEqual([items[1]]);
  });

  it("strips body before selection is confirmed", () => {
    expect(
      resolveContextItemsForInvoke({
        searchResults: [...items],
        selectedContextItems: null,
      }).every((item) => item.body === ""),
    ).toBe(true);
  });

  it("passes selected items with body after confirm", () => {
    expect(
      resolveContextItemsForInvoke({
        searchResults: [...items],
        selectedContextItems: [items[1]!],
      }),
    ).toEqual([items[1]]);
  });

  it("reads selection from last assistant message", () => {
    expect(
      resolveSelectionConfirmUpdate({
        userMessage: "草稿をお願い",
        history: [
          {
            role: "assistant",
            content: "選択確定: 2\n\nこの内容で草稿を作りますか？",
          },
        ],
      }),
    ).toEqual([2]);
  });

  it("auto-continues after selection confirm without draft", () => {
    expect(shouldAutoContinueAfterCreateDraftAssistant("選択確定: 1")).toBe(true);
    expect(
      shouldAutoContinueAfterCreateDraftAssistant(
        "選択確定: 2\n\nこの内容で草稿を作りますか？",
      ),
    ).toBe(true);
  });

  it("does not auto-continue when draft markdown is present", () => {
    expect(
      shouldAutoContinueAfterCreateDraftAssistant(
        "選択確定: 1\n\n```markdown\n---\ntitle: x\n---\n\n# hi\n```",
      ),
    ).toBe(false);
  });
});
