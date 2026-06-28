import type { ContextItem } from "@/lib/context-db/types";
import { normalizeSearchQuery } from "@/lib/context-search";
export { normalizeSearchQuery, tokenizeSearchQuery } from "@/lib/context-search";

const SEARCH_QUERY_RE = /検索キーワード[:：]\s*(.+)/;
const SEARCH_ACK_RE =
  /^(ok|okay|はい|承認|了解|そのまま|進めて|問題ない|問題なし|いいです|大丈夫)$/i;
const NONE_SELECTION_RE = /^(0|なし|不要|スキップ|skip|none)$/i;
const ALL_SELECTION_RE = /^(all|全部|すべて|全件)$/i;

type ChatHistoryMessage = { role: string; content: string };

export function parseSearchQueryFromAssistant(text: string): string | null {
  const match = SEARCH_QUERY_RE.exec(text);
  const query = match?.[1]?.trim();
  if (!query) return null;
  return normalizeSearchQuery(query);
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

function isSelectionMessage(message: string): boolean {
  const trimmed = message.trim();
  return (
    NONE_SELECTION_RE.test(trimmed) ||
    ALL_SELECTION_RE.test(trimmed) ||
    /^\d/.test(trimmed)
  );
}

export function resolveConfirmedSearchQuery(options: {
  userMessage: string;
  history: ChatHistoryMessage[];
}): string | null {
  const trimmed = options.userMessage.trim();
  if (!trimmed) return null;

  const directMatch = SEARCH_QUERY_RE.exec(trimmed);
  if (directMatch?.[1]?.trim()) {
    return normalizeSearchQuery(directMatch[1]);
  }

  if (SEARCH_ACK_RE.test(trimmed)) {
    return findLastAssistantSearchQuery(options.history);
  }

  // キーワード提案直後の修正入力（例: 「Git インストール」）
  if (
    findLastAssistantSearchQuery(options.history) &&
    !isSelectionMessage(trimmed)
  ) {
    return normalizeSearchQuery(trimmed);
  }

  return null;
}

export type ContextSelectionResult = "none" | "all" | number[];

export function parseContextSelection(
  userMessage: string,
  itemCount: number,
): ContextSelectionResult | null {
  const trimmed = userMessage.trim();
  if (!trimmed) return null;

  if (NONE_SELECTION_RE.test(trimmed)) {
    return "none";
  }

  if (ALL_SELECTION_RE.test(trimmed) || /(?:全部|すべて|全件)/.test(trimmed)) {
    return "all";
  }

  const numbers = trimmed
    .split(/[,、\s]+/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (numbers.length === 0) return null;

  const unique = [...new Set(numbers)].filter((value) => value <= itemCount);
  if (unique.length === 0) return null;

  return unique;
}

export function applyContextSelection(
  items: ContextItem[],
  selection: ContextSelectionResult,
): ContextItem[] {
  if (selection === "none") return [];
  if (selection === "all") return [...items];
  return selection
    .map((index) => items[index - 1])
    .filter((item): item is ContextItem => item !== undefined);
}
