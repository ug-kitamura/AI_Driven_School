const FENCED_BLOCK_RE = /```(?:markdown|md)?\s*\n([\s\S]*?)```/i;

export function extractMarkdownBlock(content: string): string {
  const match = FENCED_BLOCK_RE.exec(content);
  if (match?.[1]) {
    return match[1].trim();
  }
  return content.trim();
}
