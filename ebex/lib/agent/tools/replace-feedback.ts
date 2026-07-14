/**
 * replace_in_file / replace_between 向けの不一致ヒントと残留ワーニング。
 * テンプレ方言は解釈せず、狭いヒューリスティックのみ。
 */

const WHITESPACE_RE = /\s+/g;
const FILL_TOKEN_RE = /\{\{[A-Za-z_][A-Za-z0-9_]*\}\}/g;
const SPAN_MARKER_RE = /\{\{[A-Za-z_][A-Za-z0-9_]*(?:_START|_END)\}\}/;
const NEAR_MISS_LIMIT = 3;
const SNIPPET_MAX = 80;

export function collapseWhitespace(text: string): string {
  return text.replace(WHITESPACE_RE, " ").trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 厳密一致しない needle について、空白類の差だけで一致する断片を最大数件返す。
 * 自動置換には使わない（ヒント専用）。
 */
export function findWhitespaceOnlyNearMisses(
  haystack: string,
  needle: string,
  limit: number = NEAR_MISS_LIMIT,
): string[] {
  if (!needle || haystack.includes(needle)) return [];

  const collapsed = collapseWhitespace(needle);
  if (!collapsed) return [];

  const parts = collapsed.split(" ").filter(Boolean).map(escapeRegExp);
  if (parts.length === 0) return [];

  const pattern = new RegExp(parts.join("\\s+"), "g");
  const hits: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(haystack)) !== null && hits.length < limit) {
    const snippet = match[0];
    if (snippet !== needle) {
      hits.push(
        snippet.length > SNIPPET_MAX
          ? `${snippet.slice(0, SNIPPET_MAX)}…`
          : snippet,
      );
    }
    if (match[0].length === 0) pattern.lastIndex += 1;
  }
  return hits;
}

export function formatNotFoundError(
  label: string,
  needle: string,
  haystack: string,
): string {
  const preview = needle.slice(0, 80);
  const base = `${label}: ${preview}`;
  const near = findWhitespaceOnlyNearMisses(haystack, needle);
  if (near.length === 0) return base;
  const listed = near.map((s) => JSON.stringify(s)).join(", ");
  return `${base}\n近い候補（空白差のみ）: ${listed}`;
}

/**
 * 埋める印らしい残留。区間端トークン（*_START / *_END）と HTML コメントは対象外。
 */
export function findResidualFillTokens(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(FILL_TOKEN_RE)) {
    const token = match[0];
    if (SPAN_MARKER_RE.test(token)) continue;
    found.add(token);
  }
  return [...found].sort();
}

export function residualFillWarningMessage(tokens: string[]): string | null {
  if (tokens.length === 0) return null;
  const shown = tokens.slice(0, 8).join(", ");
  const more = tokens.length > 8 ? ` ほか ${tokens.length - 8} 件` : "";
  return `埋める印が残っています: ${shown}${more}`;
}
