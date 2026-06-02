import type { Series } from "@/lib/schema";
import {
  isCanonicalImagePath,
  normalizeImageLogicalPath,
} from "@/lib/image-path";

const MD_IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/g;

/** Markdown 本文から正本 `images/<filename>` 参照を抽出 */
export function extractImageRefs(content: string): string[] {
  const refs: string[] = [];
  for (const match of content.matchAll(MD_IMAGE_RE)) {
    const url = match[1]?.trim();
    if (!url || url.startsWith("data:")) continue;
    const normalized = normalizeImageLogicalPath(url);
    if (isCanonicalImagePath(normalized)) {
      refs.push(normalized);
    }
  }
  return refs;
}

/** 全レッスン content 内の正本 `images/...` 出現回数 */
export function countImageRefsInSeries(series: Series[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of series) {
    for (const course of s.courses) {
      for (const lesson of course.lessons) {
        for (const ref of extractImageRefs(lesson.content)) {
          counts.set(ref, (counts.get(ref) ?? 0) + 1);
        }
      }
    }
  }
  return counts;
}
