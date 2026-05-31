export const IMAGE_SOURCES = ["uploaded", "ai", "web"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

const IMAGE_PATH_PREFIX = "images/";

export function normalizeImageLogicalPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function isImageSource(value: string): value is ImageSource {
  return (IMAGE_SOURCES as readonly string[]).includes(value);
}

/** `images/{source}/...` 形式かつ traversal なし */
export function isSafeImageLogicalPath(path: string): boolean {
  const normalized = normalizeImageLogicalPath(path);
  if (!normalized.startsWith(IMAGE_PATH_PREFIX)) return false;
  if (normalized.includes("..")) return false;
  const rest = normalized.slice(IMAGE_PATH_PREFIX.length);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) return false;
  if (!isImageSource(parts[0])) return false;
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

export function isStagingPath(path: string): boolean {
  return /\/_staging\//.test(normalizeImageLogicalPath(path));
}

/** staging パスから promote 先の論理パス */
export function promoteTargetPath(stagingPath: string): string | null {
  const normalized = normalizeImageLogicalPath(stagingPath);
  if (!isSafeImageLogicalPath(normalized) || !isStagingPath(normalized)) {
    return null;
  }
  return normalized.replace("/_staging/", "/");
}

export function stagingDirLogical(source: ImageSource): string {
  return `images/${source}/_staging`;
}

export function imageFileName(path: string): string {
  const normalized = normalizeImageLogicalPath(path);
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

export function sourceFromPath(path: string): ImageSource | null {
  const normalized = normalizeImageLogicalPath(path);
  if (!isSafeImageLogicalPath(normalized)) return null;
  const source = normalized.slice(IMAGE_PATH_PREFIX.length).split("/")[0];
  return isImageSource(source) ? source : null;
}

export function toImageMarkdown(path: string): string {
  const name = imageFileName(path);
  const normalized = normalizeImageLogicalPath(path);
  return `![${name}](${normalized})`;
}

export function toImageApiUrl(logicalPath: string): string {
  return `/api/images/file?path=${encodeURIComponent(normalizeImageLogicalPath(logicalPath))}`;
}

export function sanitizeUploadFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "image";
  const cleaned = base.replace(/[^\w.\-()\u3000-\u9fff\u3040-\u309f\u30a0-\u30ff]+/g, "_");
  return cleaned.length > 0 ? cleaned : "image.png";
}
