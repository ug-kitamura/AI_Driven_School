import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inlineHtmlAssets } from "@/lib/agent/tools/inline-html-assets";

/**
 * 事前ビルド方式の限界が visual-explainer / Haiku 4.5 の実成果物で露呈した件の回帰。
 * 使用 319 クラスのうち 89 が同梱 subset.css に存在せず、CDN を外した瞬間に
 * レスポンシブ・hover・グラデーション・余白ユーティリティが全滅していた。
 * オンデマンドコンパイルでは実物を入力にするため 0 件でなければならない。
 */
const FIXTURE = path.resolve(
  process.cwd(),
  "workspace/20260725-untitled2/_work/bosch-content.html",
);

/** Tailwind がセレクタで使うエスケープを戻して含有判定する */
function toSelector(cls: string): string {
  return "." + cls.replace(/([:/.[\]%()#!])/g, "\\$1");
}

function usedClasses(html: string): string[] {
  return [
    ...new Set(
      (html.match(/class="([^"]*)"/g) ?? [])
        .flatMap((c) => c.slice(7, -1).split(/\s+/))
        .filter(Boolean),
    ),
  ];
}

describe.skipIf(!fs.existsSync(FIXTURE))("inlineHtmlAssets regression", () => {
  it("covers every Tailwind class the prebuilt subset missed", async () => {
    const source = fs.readFileSync(FIXTURE, "utf8");
    const { html, report } = await inlineHtmlAssets(source);

    const style = html.match(/<style data-inlined-tailwind>([\s\S]*?)<\/style>/);
    expect(style).not.toBeNull();
    const css = style![1];

    // 額縁自身の <style>（section-card 等）も照合対象に入れる。
    // Tailwind 由来でないクラスまで未収録として数えないため。
    const ownStyles = [...html.matchAll(/<style(?![^>]*data-inlined)[^>]*>([\s\S]*?)<\/style>/g)]
      .map((m) => m[1])
      .join("\n");
    const haystack = `${css}\n${ownStyles}`;

    const missing = usedClasses(html).filter(
      (cls) => !haystack.includes(toSelector(cls)) && !haystack.includes(`.${cls}`),
    );

    expect(missing, `未カバーのクラス: ${missing.join(" ")}`).toEqual([]);
    expect(report.cssBytes).toBeGreaterThan(0);
  }, 30_000);

  it("leaves no external dependency behind", async () => {
    const source = fs.readFileSync(FIXTURE, "utf8");
    const { html } = await inlineHtmlAssets(source);
    expect(html).not.toContain("cdn.tailwindcss.com");
    expect(html).not.toContain("unpkg.com/lucide");
    expect(html).not.toContain("data-lucide");
    expect(html).not.toContain("lucide.createIcons");
  }, 30_000);
});
