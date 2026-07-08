function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** プロジェクトフォルダ追加用: `{YYYYMMDD}-untitled{N}`（N は同日最大+1、初回 1） */
export function suggestUntitledFolderName(
  existingFolderIds: string[],
  date: Date = new Date(),
): string {
  const ymd = formatDateYmd(date);
  const prefix = `${ymd}-untitled`;
  const pattern = new RegExp(`^${ymd}-untitled(\\d+)$`);

  let max = 0;
  for (const id of existingFolderIds) {
    const match = id.match(pattern);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1] ?? "0", 10));
    }
  }

  return `${prefix}${max + 1}`;
}

const EVENT_DATE_PREFIX_RE = /^(\d{8})-/;

/** 既存フォルダ名からイベント日（YYYYMMDD）を取得。なければ今日 */
export function resolveEventDatePrefix(
  folderId: string,
  date: Date = new Date(),
): string {
  const match = folderId.match(EVENT_DATE_PREFIX_RE);
  if (match?.[1]) return match[1];
  return formatDateYmd(date);
}

/** AI 提案名の日付部分を既存イベント日で置き換える */
export function applyEventDateToSuggestedName(
  suggestedName: string,
  eventDatePrefix: string,
): string {
  const slugMatch = suggestedName.match(/^\d{8}-(.+)$/);
  const slug = slugMatch?.[1] ?? suggestedName;
  return `${eventDatePrefix}-${slug}`;
}
