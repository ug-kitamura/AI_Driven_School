/**
 * create-draft のクライアント連携（機械可読プロトコルのみ）。
 *
 * 検索:
 * - `検索キーワード: xxx` … 検索実行
 * - `検索結果承認` / 承認トークン … 結果確定
 *
 * 参照 item 選択（自然言語はスキルが `選択確定:` 行に変換）:
 * - `選択確定: 1,3` / `all` / `none` … contextItems をフィルタ（body 付き）
 * - 選択確定前は body を空にした一覧のみ渡し、未選択 item を織り込めないようにする
 */
import type { ContextItem } from "@/lib/context-db/types";
import { normalizeSearchQuery } from "@/lib/context-search";

export { normalizeSearchQuery, tokenizeSearchQuery } from "@/lib/context-search";

/** assistant / user 共通: `検索キーワード: xxx` */
export const SEARCH_KEYWORD_LINE_RE = /検索キーワード[:：]\s*(.+)/;

/** assistant / user 共通: `選択確定: 1,3` / `all` / `none` */
export const SELECTION_CONFIRM_LINE_RE = /選択確定[:：]\s*(.+)/;

/** 短い承認トークン（自然文パースではない） */
export const SEARCH_ACK_RE =
  /^(ok|okay|はい|承認|了解|そのまま|進めて|問題ない|問題なし|いいです|大丈夫|(まぁ)?いい(かな|です|よ)?|(それ)?(で)?(いい|よ)(かな|です|よ)?)$/i;

/** ユーザーが明示的に結果承認するときの1行プロトコル */
export const SEARCH_RESULTS_APPROVED_LINE = "検索結果承認";

export type SelectionConfirmResult = "none" | "all" | number[];

type ChatHistoryMessage = { role: string; content: string };

export function parseSearchKeywordLine(text: string): string | null {
  const match = SEARCH_KEYWORD_LINE_RE.exec(text);
  const query = match?.[1]?.trim();
  if (!query) return null;
  return normalizeSearchQuery(query);
}

/** @deprecated parseSearchKeywordLine を使用 */
export function parseSearchQueryFromAssistant(text: string): string | null {
  return parseSearchKeywordLine(text);
}

export function parseSelectionConfirmLine(
  text: string,
): SelectionConfirmResult | null {
  const match = SELECTION_CONFIRM_LINE_RE.exec(text.trim());
  if (!match?.[1]) return null;

  const value = match[1].trim();
  if (/^(none|0|なし|不要)$/i.test(value)) return "none";
  if (/^(all|全部|すべて|全件)$/i.test(value)) return "all";

  const numbers = value
    .split(/[,、\s]+/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((number) => Number.isFinite(number) && number >= 1);

  if (numbers.length === 0) return null;
  return [...new Set(numbers)];
}

/** 1 メッセージ内に複数行あれば最後の `選択確定:` を採用 */
export function parseLastSelectionConfirmLine(
  text: string,
): SelectionConfirmResult | null {
  let last: SelectionConfirmResult | null = null;
  for (const line of text.split(/\r?\n/)) {
    const parsed = parseSelectionConfirmLine(line);
    if (parsed !== null) last = parsed;
  }
  return last;
}

export function applySelectionConfirm(
  items: ContextItem[],
  selection: SelectionConfirmResult,
): ContextItem[] {
  if (selection === "none") return [];
  if (selection === "all") return [...items];
  return selection
    .map((index) => items[index - 1])
    .filter((item): item is ContextItem => item !== undefined);
}

/** 表提示用: body を空にし、未選択 item の本文参照を防ぐ */
export function toContextItemSummaries(items: ContextItem[]): ContextItem[] {
  return items.map((item) => ({ ...item, body: "" }));
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

function parsePendingSearchQueryFromLastAssistant(
  history: ChatHistoryMessage[],
): string | null {
  const lastAssistant = findLastAssistantMessage(history);
  if (!lastAssistant) return null;
  return parseSearchKeywordLine(lastAssistant.content);
}

/** assistant が `選択確定:` のみ返したとき、次フェーズへ自動 invoke する */
export function shouldAutoContinueAfterCreateDraftAssistant(
  assistantContent: string,
): boolean {
  if (parseLastSelectionConfirmLine(assistantContent) === null) {
    return false;
  }
  if (/```(?:markdown)?[\s\S]*?```/i.test(assistantContent)) {
    return false;
  }
  if (/^---\r?\n[\s\S]*?\r?\n---/m.test(assistantContent.trim())) {
    return false;
  }
  return true;
}

export function resolveSelectionConfirmUpdate(options: {
  userMessage: string;
  history: ChatHistoryMessage[];
}): SelectionConfirmResult | null {
  const fromUser = parseLastSelectionConfirmLine(options.userMessage);
  if (fromUser !== null) return fromUser;

  const lastAssistant = findLastAssistantMessage(options.history);
  if (!lastAssistant) return null;
  return parseLastSelectionConfirmLine(lastAssistant.content);
}

export function resolveContextItemsForInvoke(options: {
  searchResults: ContextItem[];
  selectedContextItems: ContextItem[] | null;
}): ContextItem[] {
  if (options.selectedContextItems !== null) {
    return options.selectedContextItems;
  }
  return toContextItemSummaries(options.searchResults);
}

/**
 * 検索結果承認前に API を叩くクエリを解決する。
 * null = 今回は検索しない（結果承認の可能性あり）。
 */
export function resolveSearchQueryRequest(options: {
  userMessage: string;
  history: ChatHistoryMessage[];
  searchResultsApproved: boolean;
}): string | null {
  if (options.searchResultsApproved) return null;

  const trimmed = options.userMessage.trim();
  if (!trimmed) return null;

  const directQuery = parseSearchKeywordLine(trimmed);
  if (directQuery) return directQuery;

  if (SEARCH_ACK_RE.test(trimmed)) {
    return parsePendingSearchQueryFromLastAssistant(options.history);
  }

  return null;
}

/** 検索結果を確定し、以降の再検索を止める */
export function shouldApproveSearchResults(options: {
  userMessage: string;
  history: ChatHistoryMessage[];
  searchResultsApproved: boolean;
  hasSearchResults: boolean;
}): boolean {
  if (options.searchResultsApproved || !options.hasSearchResults) {
    return false;
  }

  const trimmed = options.userMessage.trim();
  if (trimmed === SEARCH_RESULTS_APPROVED_LINE) return true;

  if (!SEARCH_ACK_RE.test(trimmed)) return false;

  return parsePendingSearchQueryFromLastAssistant(options.history) === null;
}

/** @deprecated resolveSearchQueryRequest を使用 */
export function resolveConfirmedSearchQuery(options: {
  userMessage: string;
  history: ChatHistoryMessage[];
}): string | null {
  return resolveSearchQueryRequest({
    ...options,
    searchResultsApproved: false,
  });
}
