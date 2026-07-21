/** EBE Purpose の 1 項目（`## N. コンセプト名` 見出しとその本文）。 */
export type PurposeConcept = {
  no: string;
  concept: string;
  description: string;
};

const HEADING_PATTERN = /^##\s+(\d+)\.\s*(.+)$/;

/**
 * `contracts/ebe-purpose.md` の `## N. コンセプト名` 見出し＋本文段落形式から
 * No./コンセプト/説明を抽出する。見出しに続く非空行を本文として結合する。
 *
 * 抽出は部分許容とする。`## N. 名前` に一致しない見出し（`# EBE Purpose` や
 * `## 補足` 等）とその配下は静かに捨て、一致した項目の抽出は妨げない。
 * 1 件も一致しなければ空配列を返し、エラー表示の判断は呼び出し側に委ねる。
 */
export function parsePurposeConcepts(markdown: string): PurposeConcept[] {
  const lines = markdown.split("\n").map((line) => line.trim());

  const concepts: PurposeConcept[] = [];
  let current: PurposeConcept | null = null;
  let descriptionLines: string[] = [];

  const flush = () => {
    if (current) {
      concepts.push({ ...current, description: descriptionLines.join("\n") });
    }
  };

  for (const line of lines) {
    const match = line.match(HEADING_PATTERN);
    if (match) {
      flush();
      current = { no: match[1]!, concept: match[2]!, description: "" };
      descriptionLines = [];
      continue;
    }
    // 見出しに一致しない行は、直前の項目の本文としてのみ拾う。項目が始まる前の
    // 前書きや、対象外の見出しの配下は捨てる。
    if (line.startsWith("#")) {
      flush();
      current = null;
      descriptionLines = [];
      continue;
    }
    if (current && line.length > 0) {
      descriptionLines.push(line);
    }
  }
  flush();

  return concepts;
}
