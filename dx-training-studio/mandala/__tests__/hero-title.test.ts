import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import { HeroTitle } from "@/components/pages/HeroTitle";

/**
 * React 要素ツリーからテキストだけを拾う。
 * ⚠ `react-dom/server` を使わないのは、mandala が `@types/react-dom` を持たず
 *   `tsc --noEmit` が汚れるため（サイト側は 0 件を保つ約束）。`HeroTitle` は
 *   hooks を持たない純関数なので、直接呼んで要素ツリーを見れば足りる。
 */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return textOf(props?.children);
  }
  return "";
}

/**
 * ヒーロー見出しの型を文字列として固定する。
 * ⚠ 全角スペースはソースを目で見ても半角と区別しにくいので、テストで縛る
 *   （2026-08-20 に全角 → 半角へ変更）。
 */
function headingText(props: { title: string; catchCopy?: string }): string {
  return textOf(HeroTitle(props));
}

describe("HeroTitle", () => {
  it("キャッチの前は半角スペース1つとダッシュ", () => {
    expect(
      headingText({ title: "DX入門コース", catchCopy: "地図を手に入れる" }),
    ).toBe("DX入門コース ——地図を手に入れる");
  });

  it("全角スペースを含まない", () => {
    expect(
      headingText({ title: "DX入門コース", catchCopy: "地図を手に入れる" }),
    ).not.toContain("　");
  });

  it("catch が無ければタイトルだけ", () => {
    const text = headingText({ title: "はじめにシリーズ" });

    expect(text).toBe("はじめにシリーズ");
    expect(text).not.toContain("——");
  });
});
