/** ATX 見出しレベル（1–6）。該当なしは null */
export function parseAtxHeading(line: string): number | null {
  const m = line.match(/^(#{1,6})\s+/);
  if (!m) return null;
  return m[1].length;
}

/** 先頭フロントマターの閉じ `---` 行インデックス（0-based）。無ければ null */
export function findFrontmatterCloseLine(lines: string[]): number | null {
  if (lines.length < 2 || lines[0].trim() !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") return i;
  }
  return null;
}

/**
 * 見出し行（0-based）を折ったときに隠す最終行（0-based, inclusive）。
 * 隠す行が無ければ null。
 */
export function findHeadingFoldEndLine(
  lines: string[],
  headingLineIndex: number,
  level: number,
): number | null {
  if (headingLineIndex >= lines.length - 1) return null;
  for (let i = headingLineIndex + 1; i < lines.length; i++) {
    const h = parseAtxHeading(lines[i]);
    if (h !== null && h <= level) return i - 1;
  }
  return lines.length - 1;
}

export type LineFoldRange = {
  /** 非表示にする先頭行（0-based, inclusive） */
  fromLineIndex: number;
  /** 非表示にする末尾行（0-based, inclusive） */
  toLineIndex: number;
};

/**
 * 指定行に折りたたみガターを付けられる場合の非表示行範囲。
 * 見出し行・FM 開始行自体は含めない。
 */
export function getFoldRangeAtLine(
  lines: string[],
  lineIndex: number,
): LineFoldRange | null {
  if (lineIndex < 0 || lineIndex >= lines.length) return null;

  if (lineIndex === 0 && lines[0].trim() === "---") {
    const close = findFrontmatterCloseLine(lines);
    if (close === null || close < 1) return null;
    return { fromLineIndex: 1, toLineIndex: close };
  }

  const level = parseAtxHeading(lines[lineIndex]);
  if (level === null) return null;

  const end = findHeadingFoldEndLine(lines, lineIndex, level);
  if (end === null || end < lineIndex + 1) return null;

  return { fromLineIndex: lineIndex + 1, toLineIndex: end };
}
