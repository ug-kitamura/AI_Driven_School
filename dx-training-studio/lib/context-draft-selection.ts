import { normalizeSearchQuery } from "@/lib/context-search";

export { normalizeSearchQuery, tokenizeSearchQuery } from "@/lib/context-search";

const SEARCH_QUERY_RE = /検索キーワード[:：]\s*(.+)/;
const SEARCH_ACK_RE =
  /^(ok|okay|はい|承認|了解|そのまま|進めて|問題ない|問題なし|いいです|大丈夫)$/i;
const SEARCH_RESULTS_APPROVAL_RE =
  /^(この結果で(?:ok|okay|進めて|いい)?|結果(?:で|に)(?:ok|問題なし|よし)|これで(?:ok|いい|進めて))$/i;

/** 「やっぱり Git で検索して」等 */
const RE_SEARCH_REQUEST_RE =
  /(?:やっぱり|改めて|もう一度)?(.+?)(?:で)?(?:検索(?:し(?:直)?(?:して)?)?)/;

/** 「ブランチも検索対象に加えて」等 — 直前クエリへの additive */
const ADD_SEARCH_TERM_RE =
  /^(.+?)(?:も)?(?:検索(?:対象)?に)?(?:加え(?:て|る)|追加(?:して)?|含め(?:て|る))(?:。)?$/;

type ChatHistoryMessage = { role: string; content: string };

export function parseSearchQueryFromAssistant(text: string): string | null {
  const match = SEARCH_QUERY_RE.exec(text);
  const query = match?.[1]?.trim();
  if (!query) return null;
  return normalizeSearchQuery(query);
}

export function findLastAssistantMessage(
  history: ChatHistoryMessage[],
): ChatHistoryMessage | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role === "assistant") return message;
  }
  return null;
}

export function findLastAssistantSearchQuery(
  history: ChatHistoryMessage[],
): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role !== "assistant") continue;
    const query = parseSearchQueryFromAssistant(message.content);
    if (query) return query;
  }
  return null;
}

export function parseReSearchQueryFromUserMessage(
  userMessage: string,
  lastSearchQuery: string | null,
): string | null {
  const trimmed = userMessage.trim();
  if (!trimmed) return null;

  const addMatch = ADD_SEARCH_TERM_RE.exec(trimmed);
  if (addMatch && lastSearchQuery) {
    const addition = normalizeSearchQuery(addMatch[1]!);
    if (addition) {
      return normalizeSearchQuery(`${lastSearchQuery} ${addition}`);
    }
  }

  const reSearchMatch = RE_SEARCH_REQUEST_RE.exec(trimmed);
  if (reSearchMatch) {
    const query = normalizeSearchQuery(reSearchMatch[1]!);
    if (query) return query;
  }

  return null;
}

/**
 * 検索結果承認前の検索クエリ解決。
 * null = 新しい検索は不要（結果承認の可能性あり）。
 */
export function resolveSearchQueryRequest(options: {
  userMessage: string;
  history: ChatHistoryMessage[];
  lastSearchQuery: string | null;
  searchResultsApproved: boolean;
}): string | null {
  if (options.searchResultsApproved) return null;

  const trimmed = options.userMessage.trim();
  if (!trimmed) return null;

  const directMatch = SEARCH_QUERY_RE.exec(trimmed);
  if (directMatch?.[1]?.trim()) {
    return normalizeSearchQuery(directMatch[1]);
  }

  const reSearch = parseReSearchQueryFromUserMessage(
    trimmed,
    options.lastSearchQuery,
  );
  if (reSearch) return reSearch;

  if (SEARCH_ACK_RE.test(trimmed)) {
    const lastAssistant = findLastAssistantMessage(options.history);
    const proposal = lastAssistant
      ? parseSearchQueryFromAssistant(lastAssistant.content)
      : null;
    if (proposal) return proposal;
    return null;
  }

  // 初回検索前: キーワード提案直後の短い修正（例: 「Git インストール」）
  if (!options.lastSearchQuery && findLastAssistantSearchQuery(options.history)) {
    return normalizeSearchQuery(trimmed);
  }

  return null;
}

export function shouldApproveSearchResults(options: {
  userMessage: string;
  history: ChatHistoryMessage[];
  searchResultsApproved: boolean;
  hasSearchResults: boolean;
}): boolean {
  if (
    options.searchResultsApproved ||
    !options.hasSearchResults
  ) {
    return false;
  }

  const trimmed = options.userMessage.trim();
  if (!SEARCH_ACK_RE.test(trimmed) && !SEARCH_RESULTS_APPROVAL_RE.test(trimmed)) {
    return false;
  }

  const lastAssistant = findLastAssistantMessage(options.history);
  if (lastAssistant && parseSearchQueryFromAssistant(lastAssistant.content)) {
    return false;
  }

  return true;
}

/** @deprecated resolveSearchQueryRequest を使用 */
export function resolveConfirmedSearchQuery(options: {
  userMessage: string;
  history: ChatHistoryMessage[];
}): string | null {
  return resolveSearchQueryRequest({
    ...options,
    lastSearchQuery: null,
    searchResultsApproved: false,
  });
}
