import { describe, expect, it } from "vitest";
import {
  bodyFreshness,
  changelogFreshness,
  computeBodySourceHash,
  computeMetaSourceHash,
  EN_META_KEYS,
  firstChangelogEntryDate,
  formatSourceHashComment,
  hasAnyEnValue,
  listMissingEnFields,
  metaFreshness,
  parseEnBody,
} from "@/lib/translation/freshness";

describe("computeBodySourceHash", () => {
  it("CRLF と LF で同一ハッシュになる", () => {
    expect(computeBodySourceHash("# 見出し\r\n本文\r\n")).toBe(
      computeBodySourceHash("# 見出し\n本文\n"),
    );
  });

  it("内容が変わればハッシュが変わる", () => {
    expect(computeBodySourceHash("a")).not.toBe(computeBodySourceHash("b"));
  });

  it("sha256:<hex 64桁> 形式を返す", () => {
    expect(computeBodySourceHash("x")).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("parseEnBody / formatSourceHashComment", () => {
  it("1行目のハッシュコメントを解析し本文から剥がす", () => {
    const hash = computeBodySourceHash("原文");
    const en = `${formatSourceHashComment(hash)}\n\n# Title\n\nBody\n`;
    const parsed = parseEnBody(en);
    expect(parsed.sourceHash).toBe(hash);
    expect(parsed.body).toBe("# Title\n\nBody\n");
  });

  it("ハッシュコメントが無ければ本文そのまま", () => {
    const parsed = parseEnBody("# Title\n");
    expect(parsed.sourceHash).toBeNull();
    expect(parsed.body).toBe("# Title\n");
  });

  it("2行目以降のコメントは拾わない", () => {
    const hash = computeBodySourceHash("原文");
    const parsed = parseEnBody(`# Title\n${formatSourceHashComment(hash)}\n`);
    expect(parsed.sourceHash).toBeNull();
  });
});

describe("bodyFreshness", () => {
  const ja = "# 見出し\n\n本文です。\n";

  it("contents.en.md 不在は untranslated", () => {
    expect(bodyFreshness(ja, null)).toBe("untranslated");
  });

  it("ハッシュ一致は fresh", () => {
    const en = `${formatSourceHashComment(computeBodySourceHash(ja))}\n# Heading\n`;
    expect(bodyFreshness(ja, en)).toBe("fresh");
  });

  it("原文が進んだら stale", () => {
    const en = `${formatSourceHashComment(computeBodySourceHash(ja))}\n# Heading\n`;
    expect(bodyFreshness(`${ja}追記\n`, en)).toBe("stale");
  });

  it("ハッシュ未記録は stale（鮮度不明は古い扱い）", () => {
    expect(bodyFreshness(ja, "# Heading\n")).toBe("stale");
  });

  it("原文の改行コードが変わっただけでは stale にならない", () => {
    const en = `${formatSourceHashComment(computeBodySourceHash(ja))}\n# Heading\n`;
    expect(bodyFreshness(ja.replace(/\n/g, "\r\n"), en)).toBe("fresh");
  });
});

describe("computeMetaSourceHash / metaFreshness", () => {
  const course = {
    level: "course" as const,
    name: "Git の三大エリア",
    catch: "キャッチ",
    description: "説明",
    target: "Git 未経験者",
  };

  it("target の変更で stale になる", () => {
    const hash = computeMetaSourceHash(course);
    expect(
      metaFreshness({ ...course, target: "変更後" }, true, hash),
    ).toBe("stale");
  });

  it("フォルダ名（name）の変更で stale になる", () => {
    const hash = computeMetaSourceHash(course);
    expect(metaFreshness({ ...course, name: "改名後" }, true, hash)).toBe(
      "stale",
    );
  });

  it("一致すれば fresh", () => {
    expect(metaFreshness(course, true, computeMetaSourceHash(course))).toBe(
      "fresh",
    );
  });

  it("_en が全て空なら untranslated", () => {
    expect(metaFreshness(course, false, null)).toBe("untranslated");
  });

  it("_en があるのにハッシュ未記録は stale", () => {
    expect(metaFreshness(course, true, null)).toBe("stale");
  });

  it("区切りの曖昧さがない（フィールド跨ぎの改行で衝突しない）", () => {
    const a = computeMetaSourceHash({
      level: "lesson",
      name: "a\nb",
      description: "",
    });
    const b = computeMetaSourceHash({
      level: "lesson",
      name: "a",
      description: "b",
    });
    expect(a).not.toBe(b);
  });

  it("レッスンは name と description だけを見る（author は影響しない前提の配列）", () => {
    const base = computeMetaSourceHash({
      level: "lesson",
      name: "L01",
      description: "desc",
    });
    expect(
      computeMetaSourceHash({ level: "lesson", name: "L01", description: "desc" }),
    ).toBe(base);
  });
});

describe("changelogFreshness", () => {
  const ja = "# 変更履歴\n\n## 2026-08-21\n\n- 追加\n\n## 2026-08-15\n\n- 初版\n";

  it("changelog.en.md 不在は untranslated", () => {
    expect(changelogFreshness(ja, null)).toBe("untranslated");
  });

  it("英語側の先頭日付が古ければ stale", () => {
    const en = "# Changelog\n\n## 2026-08-15\n\n- First\n";
    expect(changelogFreshness(ja, en)).toBe("stale");
  });

  it("先頭日付が同じなら fresh", () => {
    const en = "# Changelog\n\n## 2026-08-21\n\n- Added\n";
    expect(changelogFreshness(ja, en)).toBe("fresh");
  });

  it("英語側に日付見出しが無ければ stale", () => {
    expect(changelogFreshness(ja, "# Changelog\n")).toBe("stale");
  });

  it("日本語側が空（日付なし）なら fresh 扱い", () => {
    expect(changelogFreshness("# 変更履歴\n", "# Changelog\n")).toBe("fresh");
  });

  it("先頭エントリ日付の抽出", () => {
    expect(firstChangelogEntryDate(ja)).toBe("2026-08-21");
    expect(firstChangelogEntryDate("本文だけ")).toBeNull();
  });
});

describe("listMissingEnFields / hasAnyEnValue", () => {
  const courseFields = {
    level: "course",
    name: "Git概念コース",
    catch: "地図を手に入れる",
    description: "Git の考え方を掴む",
    target: "Git を入れたが打ったことがない人",
  } as const;

  it("部分的に埋まったメタの欠落を列挙する", () => {
    expect(
      listMissingEnFields(courseFields, {
        name_en: "Git Concepts",
        description_en: "Grasp how Git thinks",
      }),
    ).toEqual(["catch_en", "target_en"]);
  });

  it("全部埋まっていれば空", () => {
    expect(
      listMissingEnFields(courseFields, {
        name_en: "Git Concepts",
        catch_en: "Get the map",
        description_en: "Grasp how Git thinks",
        target_en: "People who installed Git",
      }),
    ).toEqual([]);
  });

  it("空白だけの値は未記入として扱う", () => {
    expect(
      listMissingEnFields(
        { level: "lesson", name: "最初のコミット", description: "add と commit" },
        { name_en: "   ", description_en: "add and commit" },
      ),
    ).toEqual(["name_en"]);
  });

  it("原文が空のフィールドは欠落に数えない", () => {
    // ⚠ 訳しようがないものを欠落にすると、未完成の日本語メタを誤検出する
    expect(
      listMissingEnFields(
        { level: "series", name: "Git基礎シリーズ", catch: "", description: "土台" },
        { name_en: "Git Basics" },
      ),
    ).toEqual(["description_en"]);
  });

  it("author_en は対象外（翻訳が触らない）", () => {
    expect(EN_META_KEYS.lesson).not.toContain("author_en");
    expect(
      listMissingEnFields(
        { level: "lesson", name: "最初のコミット", description: "add と commit" },
        { name_en: "First commit", description_en: "add and commit" },
      ),
    ).toEqual([]);
  });

  it("欠落があっても鮮度判定は変わらない（独立した軸）", () => {
    const stored = computeMetaSourceHash(courseFields);
    const partial = { name_en: "Git Concepts" };
    expect(metaFreshness(courseFields, hasAnyEnValue("course", partial), stored)).toBe(
      "fresh",
    );
    expect(listMissingEnFields(courseFields, partial)).toEqual([
      "catch_en",
      "description_en",
      "target_en",
    ]);
  });

  it("hasAnyEnValue は1つでも非空なら真", () => {
    expect(hasAnyEnValue("course", { target_en: "x" })).toBe(true);
    expect(hasAnyEnValue("course", { name_en: "  " })).toBe(false);
    expect(hasAnyEnValue("course", {})).toBe(false);
  });

  it("EN_META_KEYS の並びは階層ごとの原文順と対応する", () => {
    expect(EN_META_KEYS.root).toEqual(["name_en", "description_en"]);
    expect(EN_META_KEYS.series).toEqual([
      "name_en",
      "catch_en",
      "description_en",
    ]);
    expect(EN_META_KEYS.course).toEqual([
      "name_en",
      "catch_en",
      "description_en",
      "target_en",
    ]);
  });
});
