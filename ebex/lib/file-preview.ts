export type PreviewMode = "edit" | "preview";

/** Pane 2 の表示モード */
export type Pane2Mode =
  | "edit-preview"
  | "edit-only"
  | "view-only"
  | "unsupported";

/** view-only 内の閲覧種別 */
export type ViewOnlyKind = "image" | "pdf" | "zip";

const EDIT_PREVIEW_EXTENSIONS = new Set([
  "md",
  "html",
  "htm",
  "csv",
  "json",
  "yml",
  "yaml",
  "vtt",
]);

const EDIT_ONLY_EXTENSIONS = new Set([
  "py",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "bat",
  "ps1",
  "sh",
  "txt",
]);

const VIEW_ONLY_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
]);

const VIEW_ONLY_EXTENSIONS = new Set([
  ...VIEW_ONLY_IMAGE_EXTENSIONS,
  "pdf",
  "zip",
]);

export function fileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) return "";
  return fileName.slice(idx + 1).toLowerCase();
}

export function resolvePane2Mode(fileName: string): Pane2Mode {
  const ext = fileExtension(fileName);
  if (!ext) return "unsupported";
  if (EDIT_PREVIEW_EXTENSIONS.has(ext)) return "edit-preview";
  if (EDIT_ONLY_EXTENSIONS.has(ext)) return "edit-only";
  if (VIEW_ONLY_EXTENSIONS.has(ext)) return "view-only";
  return "unsupported";
}

/** `edit-preview` 判定の薄いラッパ（後方互換） */
export function supportsPreview(fileName: string): boolean {
  return resolvePane2Mode(fileName) === "edit-preview";
}

export function isTextEditableMode(mode: Pane2Mode): boolean {
  return mode === "edit-preview" || mode === "edit-only";
}

export function resolveViewOnlyKind(fileName: string): ViewOnlyKind | null {
  if (resolvePane2Mode(fileName) !== "view-only") return null;
  const ext = fileExtension(fileName);
  if (VIEW_ONLY_IMAGE_EXTENSIONS.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "zip") return "zip";
  return null;
}

export function contentTypeForExtension(ext: string): string | null {
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    default:
      return null;
  }
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
