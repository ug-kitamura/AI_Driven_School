import { describe, expect, it } from "vitest";
import {
  normalizeSearchQuery,
  tokenizeSearchQuery,
} from "@/lib/context-search";

describe("context-search", () => {
  it("strips explanation after spaced hyphen", () => {
    expect(
      normalizeSearchQuery(
        "Git インストール - このキーワードで社内コンテキストを検索します。",
      ),
    ).toBe("Git インストール");
  });

  it("tokenizes multiple keywords for OR search", () => {
    expect(tokenizeSearchQuery("Git インストール 環境構築")).toEqual([
      "Git",
      "インストール",
      "環境構築",
    ]);
  });
});
