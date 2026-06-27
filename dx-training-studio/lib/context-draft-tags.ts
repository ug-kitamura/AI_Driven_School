const BRACKET_TAGS_RE = /\[([^\]]+)\]/g;

const TAG_ACK_RE =
  /^(ok|okay|はい|承認|了解|そのまま|進めて|問題ない|問題なし|いいです|大丈夫)/i;

export function parseTagsFromBracketFormat(text: string): string[] | null {
  const matches = [...text.matchAll(BRACKET_TAGS_RE)];
  if (matches.length === 0) return null;

  const last = matches[matches.length - 1]?.[1];
  if (!last) return null;

  const tags = last
    .split(/[,、]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : null;
}

export function resolveConfirmedCreateDraftTags(options: {
  userMessage: string;
  history: Array<{ role: string; content: string }>;
}): string[] | null {
  const fromUser = parseTagsFromBracketFormat(options.userMessage);
  if (fromUser?.length) return fromUser;

  const trimmed = options.userMessage.trim();
  if (!TAG_ACK_RE.test(trimmed)) return null;

  for (let index = options.history.length - 1; index >= 0; index -= 1) {
    const message = options.history[index];
    if (message.role !== "assistant") continue;
    const tags = parseTagsFromBracketFormat(message.content);
    if (tags?.length) return tags;
  }

  return null;
}
