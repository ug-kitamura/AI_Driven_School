/** 社内コンテキスト全文検索用のクエリ正規化・トークン化 */

/** 検索キーワード行の末尾説明（— / - 以降）を除いて正規化する */
export function normalizeSearchQuery(raw: string): string {
  const firstLine = raw.split(/\r?\n/)[0] ?? raw;
  const beforeDash =
    firstLine.split(/\s*[—–]\s*|\s+-\s+/)[0] ?? firstLine;
  return beforeDash.trim();
}

/** 空白・カンマ区切りでキーワードを分割する（OR 検索用） */
export function tokenizeSearchQuery(raw: string): string[] {
  return normalizeSearchQuery(raw)
    .split(/[\s,、]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !/^[-—–]+$/.test(token));
}
