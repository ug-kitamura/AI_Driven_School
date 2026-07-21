export type PreviewMode = "edit" | "preview";

const PREVIEW_FIRST_EXTENSIONS = new Set(["html", "htm", "csv", "vtt"]);

/** `edit-preview` 対象ファイルの初期表示モード（閲覧主目的の拡張子は Preview） */
export function resolveInitialViewMode(fileName: string): PreviewMode {
  return PREVIEW_FIRST_EXTENSIONS.has(fileExtension(fileName))
    ? "preview"
    : "edit";
}

/** Markdown プレビュー内リンクの分類結果 */
export type MarkdownLinkAction =
  | { type: "anchor"; id: string }
  | { type: "open-file"; folderPath: string; fileName: string }
  | { type: "copy-external"; url: string }
  | { type: "blocked" };

/**
 * Markdown プレビュー内リンクを分類する。
 * 相対パスは表示中ファイルのフォルダ（workspace 相対、例: `demo/docs`）基準で
 * 正規化し、同一プロジェクトフォルダ内に収まる場合のみ open-file にする。
 */
export function resolveMarkdownLink(
  href: string,
  currentFolderPath: string,
): MarkdownLinkAction {
  if (!href) return { type: "blocked" };

  if (href.startsWith("#")) {
    const id = decodeURIComponent(href.slice(1));
    return id ? { type: "anchor", id } : { type: "blocked" };
  }

  if (/^https?:\/\//i.test(href)) {
    return { type: "copy-external", url: href };
  }

  // mailto: / javascript: / data: などのスキーム、および絶対パスは無効
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/")) {
    return { type: "blocked" };
  }

  const withoutFragment = href.split("#")[0]?.split("?")[0] ?? "";
  if (!withoutFragment) return { type: "blocked" };

  const segments = currentFolderPath.split("/").filter(Boolean);
  const projectFolder = segments[0];
  if (!projectFolder) return { type: "blocked" };

  const resolved = [...segments];
  for (const part of decodeURIComponent(withoutFragment).split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (resolved.length === 0) return { type: "blocked" };
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }

  if (resolved.length < 2 || resolved[0] !== projectFolder) {
    return { type: "blocked" };
  }

  const fileName = resolved[resolved.length - 1];
  const folderPath = resolved.slice(0, -1).join("/");
  return { type: "open-file", folderPath, fileName };
}

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

export type VttCue = {
  /** 開始タイムスタンプ（例 `00:00:02.000`） */
  start: string;
  /** 終了タイムスタンプ（例 `00:00:06.500`） */
  end: string;
  /** 話者名。特定できない場合は null（表示側で「不明」扱い） */
  speaker: string | null;
  /** 話者タグ・接頭辞を除去した発話本文 */
  text: string;
};

/** `<v 話者名>...</v>` 優先、無ければ行頭 `話者名:`、いずれも無ければ null */
function extractVttSpeaker(rawText: string): {
  speaker: string | null;
  text: string;
} {
  const voiceMatch = rawText.match(/<v\s+([^>]+)>/);
  if (voiceMatch) {
    const speaker = (voiceMatch[1] ?? "").trim();
    const text = rawText.replace(/<\/?v[^>]*>/g, "").trim();
    return { speaker: speaker || null, text };
  }
  // フォールバック: 行頭の「話者名:」（空白を含まない短いラベルのみ）
  const prefixMatch = rawText.match(/^([^\s:：]{1,20})[:：]\s*([\s\S]+)$/);
  if (prefixMatch) {
    return {
      speaker: (prefixMatch[1] ?? "").trim() || null,
      text: (prefixMatch[2] ?? "").trim(),
    };
  }
  return { speaker: null, text: rawText.replace(/<\/?v[^>]*>/g, "").trim() };
}

export function parseVtt(content: string): VttCue[] {
  const cues: VttCue[] = [];
  const blocks = content.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const timeLineIndex = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIndex === -1) continue;
    const [startRaw, endRaw] = lines[timeLineIndex].split("-->");
    const start = (startRaw ?? "").trim();
    // 終了時刻の後に続く配置設定（align:start 等）を落とす
    const end = (endRaw ?? "").trim().split(/\s+/)[0] ?? "";
    const rawText = lines
      .slice(timeLineIndex + 1)
      .join("\n")
      .trim();
    if (!rawText) continue;
    const { speaker, text } = extractVttSpeaker(rawText);
    if (!text) continue;
    cues.push({ start, end, speaker, text });
  }
  return cues;
}

/** 話者名から決定的に 0–359 の色相を導出する（同一話者は常に同じ色） */
export function vttSpeakerHue(speaker: string): number {
  let hash = 0;
  for (let i = 0; i < speaker.length; i += 1) {
    hash = (hash * 31 + speaker.charCodeAt(i)) % 360;
  }
  return hash;
}

/** タイムスタンプからミリ秒（`.000`）を除去して表示用に整形する */
export function formatVttTimestamp(timestamp: string): string {
  return timestamp.replace(/\.\d+$/, "");
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
      return {
        formatted: JSON.stringify(JSON.parse(content), null, 2),
        error: null,
      };
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
