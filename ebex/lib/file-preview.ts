export type PreviewMode = "edit" | "preview";

export function fileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

export function supportsPreview(fileName: string): boolean {
  const ext = fileExtension(fileName);
  return ["md", "html", "htm", "csv", "json", "yml", "yaml", "vtt"].includes(ext);
}

export function parseVtt(content: string): Array<{ time: string; text: string }> {
  const cues: Array<{ time: string; text: string }> = [];
  const blocks = content.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const text = lines.slice(lines.indexOf(timeLine) + 1).join("\n").trim();
    if (text) cues.push({ time: timeLine.trim(), text });
  }
  return cues;
}

export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) continue;
    rows.push(line.split(",").map((cell) => cell.trim()));
  }
  return rows;
}

export function formatStructuredPreview(
  content: string,
  ext: string,
): { formatted: string; error: string | null } {
  try {
    if (ext === "json") {
      return { formatted: JSON.stringify(JSON.parse(content), null, 2), error: null };
    }
    if (ext === "yml" || ext === "yaml") {
      return { formatted: content, error: null };
    }
    return { formatted: content, error: null };
  } catch (err) {
    return {
      formatted: content,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
