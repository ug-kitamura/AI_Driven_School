import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parsePurposeConcepts } from "@/lib/purpose-concepts";
import { PURPOSE_RELATIVE_PATH } from "@/lib/workspace-path-utils";

describe("parsePurposeConcepts", () => {
  it("同梱の ebe-purpose.md から 10 件を抽出する", () => {
    const markdown = fs.readFileSync(
      path.join(process.cwd(), PURPOSE_RELATIVE_PATH),
      "utf-8",
    );
    const concepts = parsePurposeConcepts(markdown);

    expect(concepts).toHaveLength(10);
    expect(concepts[0]).toEqual({
      no: "1",
      concept: "Soil （土壌）",
      description: "個人の成長を支える、PMTの確固たる土台を築きます",
    });
    expect(concepts.at(-1)?.no).toBe("10");
  });

  it("`# 見出し` は項目として拾わない", () => {
    const concepts = parsePurposeConcepts(
      ["# EBE Purpose", "", "## 1. Soil", "土壌の説明"].join("\n"),
    );

    expect(concepts).toEqual([
      { no: "1", concept: "Soil", description: "土壌の説明" },
    ]);
  });

  it("想定外の見出しが混ざっても他の項目は壊れない", () => {
    const concepts = parsePurposeConcepts(
      [
        "## 1. Soil",
        "土壌の説明",
        "",
        "## 補足",
        "この段落は項目に属さない",
        "",
        "## 2. Leaf",
        "葉の説明",
      ].join("\n"),
    );

    expect(concepts).toEqual([
      { no: "1", concept: "Soil", description: "土壌の説明" },
      { no: "2", concept: "Leaf", description: "葉の説明" },
    ]);
  });

  it("複数行の本文を改行で結合する", () => {
    const concepts = parsePurposeConcepts(
      ["## 3. Sunshine", "1 行目", "2 行目"].join("\n"),
    );

    expect(concepts[0]?.description).toBe("1 行目\n2 行目");
  });

  it("一致する見出しが無ければ空配列を返す", () => {
    const concepts = parsePurposeConcepts(
      ["# EBE Purpose", "", "## 補足", "本文のみ"].join("\n"),
    );

    expect(concepts).toEqual([]);
  });

  it("空文字でも例外を投げない", () => {
    expect(parsePurposeConcepts("")).toEqual([]);
  });
});
