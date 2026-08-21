import { siteChrome } from "@/lib/site-data";

export type ReleaseInfo = {
  /** サイドバー最上部に出す1行（例: `2026.08.21 12:34 更新 (v1.2.3)`）。出せなければ undefined */
  line?: string;
  /** リリース番号（タグ名）。タグ由来のビルドでなければ undefined */
  release?: string;
  repositoryUrl: string;
};

/**
 * 日時文字列を `Asia/Tokyo` で `YYYY.MM.DD HH:mm` に整形する。
 *
 * ⚠ 素の `Date` のローカル書式に頼らないこと——ビルドマシン（CI / Vercel）は
 * UTC なので、そのまま出すと前日の日時になる。`Intl.DateTimeFormat` に
 * timeZone を明示すれば、どの TZ の環境でも同じ結果になる（テストで担保）。
 *
 * 日付だけの値（`YYYY-MM-DD`。changelog フォールバック）は時刻を持たないので
 * `YYYY.MM.DD` を返す——`00:00` をでっち上げない。
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

  // ja-JP の 2-digit 書式は `2026/08/21 12:34`。区切りだけ `.` に揃える
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return formatted.replaceAll("/", ".");
}

/**
 * サイドバー最上部の1行を組み立てる。
 *
 * - 全ビルドで出す: `YYYY.MM.DD HH:mm 更新`
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
