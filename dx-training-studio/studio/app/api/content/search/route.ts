import { getProjectRoot } from "@/lib/project-root";
import { loadContentsFolder } from "@/lib/contents-loader";

/** これを超える一致は打ち切り、絞り込みを促す（EBEX の全文検索と同じ上限） */
const MATCH_LIMIT = 200;

export type ContentSearchResponse = {
  matches: Array<{ series: string; course?: string; lesson?: string }>;
  truncated: boolean;
};

/**
 * コンテンツ全文検索。`contents/` のレッスン本文と各階層の名前を
 * 大文字小文字無視の部分一致で検索する。読み方はローダー
 * （`loadContentsFolder`）に委ねることで、走査規則・BOM の扱いを
 * ツリー表示と一致させる。
 */
export function GET(request: Request): Response {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) {
    return Response.json({ matches: [], truncated: false });
  }
  const needle = q.toLowerCase();
  const includes = (value: string) => value.toLowerCase().includes(needle);

  const series = loadContentsFolder(getProjectRoot());
  const matches: ContentSearchResponse["matches"] = [];
  let truncated = false;

  const push = (match: ContentSearchResponse["matches"][number]): boolean => {
    if (matches.length >= MATCH_LIMIT) {
      truncated = true;
      return false;
    }
    matches.push(match);
    return true;
  };

  outer: for (const s of series) {
    if (includes(s.name)) {
      if (!push({ series: s.name })) break;
      continue;
    }
    for (const c of s.courses) {
      if (includes(c.name)) {
        if (!push({ series: s.name, course: c.name })) break outer;
        continue;
      }
      for (const l of c.lessons) {
        if (includes(l.lesson) || includes(l.content)) {
          if (!push({ series: s.name, course: c.name, lesson: l.lesson })) {
            break outer;
          }
        }
      }
    }
  }

  return Response.json({ matches, truncated });
}
