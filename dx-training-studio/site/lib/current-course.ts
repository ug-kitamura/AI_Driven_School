/**
 * 表示中のページからコースを解く（純関数）。
 *
 * レッスンページは素の MDX で `components/pages` を通らないため、ページ側から
 * 現在地を渡す経路が無い。パスから解くのが唯一の道で、SiteShell が
 * `usePathname()` で言語を解いているのと同じ流儀に合わせている。
 */
import { stripLocale } from "@/lib/locale-path";
import type { SiteSeries } from "@/lib/site-data";

/**
 * `/git/concepts` `/git/concepts/three-areas` `/en/git/concepts` → コース ID。
 * 全体トップ・シリーズトップなどコースが決まらないパスでは null。
 */
export function findCourseIdByPath(
  series: SiteSeries[],
  pathname: string,
): string | null {
  const segments = stripLocale(pathname).split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [seriesSlug, courseSlug] = segments;
  const course = series
    .find((s) => s.slug === seriesSlug)
    ?.courses.find((c) => c.slug === courseSlug);

  return course?.id ?? null;
}
