export const WORKSPACE_DIR_NAME = "workspace";
export const SESSION_FILENAME = "session.json";
/** EBE Purpose の正本。ebex ルートからの相対パス。 */
export const PURPOSE_RELATIVE_PATH = "contracts/ebe-purpose.md";

const INVALID_NAME_RE = /[\\/:*?"<>|]/;

export function validateFolderSegment(segment: string): string | null {
  const trimmed = segment.trim();
  if (!trimmed) return "フォルダ名が空です";
  if (trimmed.includes("..")) return "不正なフォルダ名です";
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return "不正なフォルダ名です";
  }
  if (INVALID_NAME_RE.test(trimmed)) return "不正なフォルダ名です";
  return null;
}

/** @deprecated use validateFolderSegment for a single segment */
export function validateFolderId(folderId: string): string | null {
  return validateFolderSegment(folderId);
}

export function validateRelativeFolderPath(folderPath: string): string | null {
  const trimmed = folderPath.trim();
  if (!trimmed) return "フォルダパスが空です";
  if (trimmed.includes("..")) return "不正なフォルダパスです";
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
    return "不正なフォルダパスです";
  }
  if (trimmed.includes("\\")) return "不正なフォルダパスです";

  const segments = trimmed.split("/");
  for (const segment of segments) {
    if (!segment) return "不正なフォルダパスです";
    const segmentError = validateFolderSegment(segment);
    if (segmentError) return segmentError;
  }
  return null;
}

export function validateFileName(fileName: string): string | null {
  const trimmed = fileName.trim();
  if (!trimmed) return "ファイル名が空です";
  if (trimmed.includes("..")) return "不正なファイル名です";
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return "不正なファイル名です";
  }
  if (INVALID_NAME_RE.test(trimmed)) return "不正なファイル名です";
  if (trimmed === SESSION_FILENAME) return "予約済みファイル名です";
  return null;
}

export function getProjectFolderId(folderPath: string): string {
  return folderPath.split("/")[0] ?? folderPath;
}
