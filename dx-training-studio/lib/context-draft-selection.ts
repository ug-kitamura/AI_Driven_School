import type { ContextItem } from "@/lib/context-db/types";

import { normalizeSearchQuery } from "@/lib/context-search";

export { normalizeSearchQuery, tokenizeSearchQuery } from "@/lib/context-search";



const SEARCH_QUERY_RE = /検索キーワード[:：]\s*(.+)/;

const SEARCH_ACK_RE =

  /^(ok|okay|はい|承認|了解|そのまま|進めて|問題ない|問題なし|いいです|大丈夫)$/i;

const NONE_SELECTION_RE = /^(0|なし|不要|スキップ|skip|none)$/i;

const ALL_SELECTION_RE = /^(all|全部|すべて|全件)$/i;



const NONE_SELECTION_INTENT_RE =

  /(?:参照(?:し(?:なく(?:て(?:も|は|よ)?|ない)|(?:しない|いらない|不要))|(?:不要|いらない))|[使参]わ(?:ない|なく)|要(?:ら)?ない|なく(?:て(?:も|)?(?:いい|よ)|ていい(?:や|)?)|不要(?:です|だ)?|スキップ|skip|none)/i;



const ALL_SELECTION_INTENT_RE =

  /(?:^|\s)(?:all|全部|すべて|全件)(?:\s|$)|(?:全部|すべて|全件)(?:を)?(?:参照|使(?:用|う)?)|(?:参照(?:して|する)?|使(?:って|う)?)\s*(?:全部|すべて|全件)/i;



type ChatHistoryMessage = { role: string; content: string };



function normalizeAsciiDigits(text: string): string {

  return text.replace(/[０-９]/g, (char) =>

    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),

  );

}



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



function hasNoneSelectionIntent(text: string): boolean {

  const trimmed = text.trim();

  if (!trimmed) return false;

  if (NONE_SELECTION_RE.test(trimmed)) return true;

  if (/(?:全部|すべて|全件).*(?:いらない|不要|参照(?:し(?:ない|なく)|しない))/.test(trimmed)) {

    return true;

  }

  return NONE_SELECTION_INTENT_RE.test(trimmed);

}



function hasAllSelectionIntent(text: string): boolean {

  const trimmed = text.trim();

  if (!trimmed) return false;

  if (hasNoneSelectionIntent(trimmed)) return false;

  if (ALL_SELECTION_RE.test(trimmed)) return true;

  return ALL_SELECTION_INTENT_RE.test(trimmed);

}



function extractSelectionNumbers(text: string, itemCount: number): number[] {

  const normalized = normalizeAsciiDigits(text.trim());

  const found = new Set<number>();



  for (const match of normalized.matchAll(

    /(?:^|[、,\sと]|やっぱり|は)\s*(\d{1,2})\s*(?:番(?:目)?|つ目|個目|にして|だけ|を)?/gi,

  )) {

    const value = Number.parseInt(match[1]!, 10);

    if (value >= 1 && value <= itemCount) found.add(value);

  }



  for (const part of normalized.split(/[,、\sと]+/)) {

      const value = Number.parseInt(part.trim(), 10);

      if (Number.isFinite(value) && value >= 1 && value <= itemCount) {

        found.add(value);

      }

    }



  return [...found].sort((a, b) => a - b);

}



function isSelectionMessage(message: string): boolean {

  const trimmed = message.trim();

  if (SEARCH_ACK_RE.test(trimmed)) return false;

  if (hasNoneSelectionIntent(trimmed) || hasAllSelectionIntent(trimmed)) {

    return true;

  }

  if (/^[\d０-９\s,、と]+$/.test(trimmed)) return true;

  if (

    /(?:やっぱり|番|にして|だけ|を|\d\s*[,\、と])/.test(trimmed) &&

    /[\d０-９]/.test(trimmed)

  ) {

    return true;

  }

  return false;

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



/**

 * 検索結果に対するユーザーの選択意図を解釈する。

 * 確定フラグに依存せず、各メッセージから none / all / 番号配列を導出する。

 */

export function parseContextSelectionIntent(

  userMessage: string,

  itemCount: number,

): ContextSelectionResult | null {

  const trimmed = userMessage.trim();

  if (!trimmed || itemCount <= 0) return null;



  if (hasNoneSelectionIntent(trimmed)) {

    return "none";

  }



  if (hasAllSelectionIntent(trimmed)) {

    return "all";

  }



  const numbers = extractSelectionNumbers(trimmed, itemCount);

  if (numbers.length === 0) return null;



  return numbers;

}



/** @deprecated parseContextSelectionIntent を使用 */

export function parseContextSelection(

  userMessage: string,

  itemCount: number,

): ContextSelectionResult | null {

  return parseContextSelectionIntent(userMessage, itemCount);

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


