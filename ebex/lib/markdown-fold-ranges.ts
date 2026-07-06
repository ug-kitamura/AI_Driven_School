export function isFrontmatterDelimiterLine(line: string): boolean {
  return /^-{3,}\s*$/.test(line.trim());
}

export function getFoldRangeAtLine(
  _lines: string[],
  _lineIndex: number,
): { fromLineIndex: number; toLineIndex: number } | null {
  return null;
}
