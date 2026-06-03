export const IMAGE_SOURCES = ["uploaded", "ai", "web"] as const;
export type ImageSource = (typeof IMAGE_SOURCES)[number];

export const IMAGE_TRASH_DIR = "trash";

const IMAGE_PATH_PREFIX = "images/";

export function normalizeImageLogicalPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function isImageSource(value: string): value is ImageSource {
  return (IMAGE_SOURCES as readonly string[]).includes(value);
}

function pathPartsAfterImages(normalized: string): string[] {
  if (!normalized.startsWith(IMAGE_PATH_PREFIX)) return [];
  return normalized.slice(IMAGE_PATH_PREFIX.length).split("/").filter(Boolean);
}

/** trash: `images/trash/<filename>` */
export function isTrashImagePath(path: string): boolean {
  const parts = pathPartsAfterImages(normalizeImageLogicalPath(path));
  if (parts.length !== 2) return false;
  if (parts[0] !== IMAGE_TRASH_DIR) return false;
  return parts[1].length > 0 && parts[1] !== "." && parts[1] !== "..";
}

/** 正本: `images/<filename>`（1 セグメント、予約ディレクトリ名は不可） */
export function isCanonicalImagePath(path: string): boolean {
  const parts = pathPartsAfterImages(normalizeImageLogicalPath(path));
  if (parts.length !== 1) return false;
  if (isImageSource(parts[0])) return false;
  if (parts[0] === IMAGE_TRASH_DIR) return false;
  return parts[0].length > 0 && parts[0] !== "." && parts[0] !== "..";
}

export function trashDirLogical(): string {
  return `${IMAGE_PATH_PREFIX}${IMAGE_TRASH_DIR}`;
}

/** staging: `images/{source}/<filename>` */
export function isStagingImagePath(path: string): boolean {
  const parts = pathPartsAfterImages(normalizeImageLogicalPath(path));
  if (parts.length !== 2) return false;
  if (!isImageSource(parts[0])) return false;
  return parts[1].length > 0 && parts[1] !== "." && parts[1] !== "..";
}

/** 正本または staging の論理パス */
export function isSafeImageLogicalPath(path: string): boolean {
  const normalized = normalizeImageLogicalPath(path);
  if (!normalized.startsWith(IMAGE_PATH_PREFIX)) return false;
  if (normalized.includes("..")) return false;
  return isCanonicalImagePath(normalized) || isStagingImagePath(normalized);
}

/** @deprecated staging は `isStagingImagePath` を使用 */
export function isStagingPath(path: string): boolean {
  return isStagingImagePath(path);
}

/** staging パスから正本の論理パス */
export function promoteTargetPath(stagingPath: string): string | null {
  const normalized = normalizeImageLogicalPath(stagingPath);
  if (!isStagingImagePath(normalized)) return null;
  const fileName = pathPartsAfterImages(normalized)[1];
  return `${IMAGE_PATH_PREFIX}${fileName}`;
}

export function stagingDirLogical(source: ImageSource): string {
  return `images/${source}`;
}

export function imageFileName(path: string): string {
  const normalized = normalizeImageLogicalPath(path);
  const parts = pathPartsAfterImages(normalized);
  return parts[parts.length - 1] ?? normalized;
}

export function sourceFromPath(path: string): ImageSource | null {
  const normalized = normalizeImageLogicalPath(path);
  if (!isStagingImagePath(normalized)) return null;
  const source = pathPartsAfterImages(normalized)[0];
  return isImageSource(source) ? source : null;
}

export function toImageMarkdown(path: string, alt?: string): string {
  const name = imageFileName(path);
  const normalized = normalizeImageLogicalPath(path);
  const canonical = isCanonicalImagePath(normalized)
    ? normalized
    : promoteTargetPath(normalized) ?? normalized;
  const label = alt?.trim() || name;
  return `![${label}](${canonical})`;
}

export function toImageApiUrl(logicalPath: string): string {
  return `/api/images/file?path=${encodeURIComponent(normalizeImageLogicalPath(logicalPath))}`;
}

export function sanitizeUploadFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "image";
  const cleaned = base.replace(/[^\w.\-()\u3000-\u9fff\u3040-\u309f\u30a0-\u30ff]+/g, "_");
  return cleaned.length > 0 ? cleaned : "image.png";
}
