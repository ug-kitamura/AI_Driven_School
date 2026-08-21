import { siteChrome } from "@/lib/site-data";

export type ReleaseInfo = {
  /** サイドバー最上部に出す1行（例: `2026.08.21 更新 (v1.2.3)`）。出せなければ undefined */
  line?: string;
  /** リリース番号（タグ名）。タグ由来のビルドでなければ undefined */
  release?: string;
  repositoryUrl: string;
};

/**
 * 日時文字列を `Asia/Tokyo` の日付 `YYYY.MM.DD` に整形する。
 *
 * 時・分は出さない（2026-08-21 決定）——受講者には日付で十分で、
 * 行が短くなるうえ、changelog フォールバック（日付のみ）とも表示が揃う。
 *
 * ⚠ 時刻を出さなくても TZ 処理は消せない。素の `Date` のローカル書式に
 * 頼ると、UTC のビルドマシン（CI / Vercel）では**日付そのものが前日にズレる**。
 * `Intl.DateTimeFormat` に timeZone を明示すれば、どの TZ の環境でも
 * 同じ結果になる（テストで担保）。
 *
 * 解釈できない値は undefined（呼び出し側が行ごと消す）。
 */
export function formatUpdateDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed.replaceAll("-", ".");
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;

  // ja-JP の 2-digit 書式は `2026/08/21`。区切りだけ `.` に揃える
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return formatted.replaceAll("/", ".");
}

/**
 * サイドバー最上部の1行を組み立てる。
 *
 * - 全ビルドで出す: `YYYY.MM.DD 更新`
 * - タグ由来のビルド（Pages）は ` (vX.Y.Z)` を併記
 * - 日時が無い（git も changelog フォールバックも取れなかった）ときは、
 *   タグ名があっても行ごと出さない——偽の日時をでっち上げず、
 *   出所の無い情報も出さない（spec: publishing-site-deployment）
 */
export function buildVersionLine(
  rawDate: string | undefined,
  rawRelease: string | undefined,
): string | undefined {
  const release = rawRelease?.trim() || undefined;
  const formatted = rawDate ? formatUpdateDate(rawDate) : undefined;

  if (!formatted) return undefined;
  return release ? `${formatted} 更新 (${release})` : `${formatted} 更新`;
}

/**
 * ビルド時に注入された情報からサイドバーの表示を解決する。
 *
 * - `NEXT_PUBLIC_SITE_COMMIT_DATE`: next.config.mjs がビルド時に解決した
 *   HEAD の commit date（取れなければ changelog 先頭日付、どちらも無ければ空）
 * - `NEXT_PUBLIC_SITE_RELEASE`: リリースワークフローが入れるタグ名
 */
export function resolveReleaseInfo(
  rawRelease: string | undefined = process.env.NEXT_PUBLIC_SITE_RELEASE,
  rawDate: string | undefined = process.env.NEXT_PUBLIC_SITE_COMMIT_DATE,
): ReleaseInfo {
  const release = rawRelease?.trim() || undefined;
  return {
    line: buildVersionLine(rawDate, rawRelease),
    release,
    repositoryUrl: siteChrome().githubUrl,
  };
}
