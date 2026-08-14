/**
 * site の読み取り専用ローダーが Studio の `lib/contents-loader.ts` とずれていないかを検出する。
 *
 * site は独立プロジェクトで Studio の `lib/` を import しないため（design D2）、
 * 実際の `contents/` を site 側で読んだ結果と、Studio 側で読んだ結果（別プロセスで取得）を突き合わせる。
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadContents } from "../scripts/lib/content-source.mts";

const siteRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const studioRoot = path.resolve(siteRoot, "..");
const contentsDir = path.join(studioRoot, "contents");

type Shape = {
  series: Array<{
    name: string;
    slug?: string;
    courses: Array<{
      name: string;
      slug?: string;
      lessons: Array<{ name: string; slug?: string; status: string }>;
    }>;
  }>;
};

/** Studio 側のローダーを別プロセスで実行して同じ形に畳む */
function loadViaStudio(): { shape: Shape } | { error: string } {
  const script = `
    import { loadContentsFolder } from "@/lib/contents-loader";
    const series = loadContentsFolder(process.cwd()).map((s) => ({
      name: s.name,
      slug: s.slug,
      courses: s.courses.map((c) => ({
        name: c.name,
        slug: c.slug,
        lessons: c.lessons.map((l) => ({ name: l.lesson, slug: l.slug, status: l.status })),
      })),
    }));
    process.stdout.write(JSON.stringify({ series }));
  `;
  const scriptPath = path.join(studioRoot, `.parity-probe-${process.pid}.mts`);
  const hooksPath = path.join(
    siteRoot,
    "__tests__",
    "helpers",
    "studio-alias-register.mjs",
  );
  fs.writeFileSync(scriptPath, script, "utf-8");
  try {
    const stdout = execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--no-warnings",
        "--import",
        pathToFileURL(hooksPath).href,
        scriptPath,
      ],
      {
        cwd: studioRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, STUDIO_ROOT: studioRoot },
      },
    );
    return { shape: JSON.parse(stdout) as Shape };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: detail };
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }
}

function loadViaSite(): Shape {
  return {
    series: loadContents(contentsDir).series.map((s) => ({
      name: s.name,
      slug: s.slug,
      courses: s.courses.map((c) => ({
        name: c.name,
        slug: c.slug,
        lessons: c.lessons.map((l) => ({
          name: l.name,
          slug: l.slug,
          status: l.status,
        })),
      })),
    })),
  };
}

describe("content-source が Studio のローダーとずれない", () => {
  it("実 contents/ を読んだ構造が一致する", () => {
    const site = loadViaSite();
    expect(site.series.length).toBeGreaterThan(0);

    const studio = loadViaStudio();
    if ("error" in studio) {
      // 実行できないこと自体を失敗にする——スキップすると規則のずれを見逃す
      throw new Error(
        `Studio 側ローダーを実行できませんでした:\n${studio.error}`,
      );
    }
    expect(site).toEqual(studio.shape);
  });

  it("`_` / `.` 始まりのディレクトリを構造に含めない", () => {
    const site = loadViaSite();
    const names = [
      ...site.series.map((s) => s.name),
      ...site.series.flatMap((s) => s.courses.map((c) => c.name)),
    ];
    expect(names.some((n) => n.startsWith("_") || n.startsWith("."))).toBe(
      false,
    );
  });
});
