import { STORAGE_KEYS } from "@/lib/storage-keys";

/** 空フォルダの `no file` プレースホルダ選択。UI ラベルと同一文字列。 */
export const NO_FILE_SENTINEL = "no file";

export function isNoFileSentinel(fileName: string): boolean {
  return fileName === NO_FILE_SENTINEL;
}

export type LastFileSelection = {
  folderPath: string;
  fileName: string;
};

type StoredSelection = Partial<{
  folderPath: string;
  folderId: string;
  fileName: string;
}>;

export function loadLastFileSelection(): LastFileSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.lastFile);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSelection;
    const folderPath = parsed.folderPath ?? parsed.folderId;
    if (!folderPath || !parsed.fileName) return null;
    return { folderPath, fileName: parsed.fileName };
  } catch {
    return null;
  }
}

export function saveLastFileSelection(selection: LastFileSelection): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.lastFile, JSON.stringify(selection));
  } catch {
    // ignore
  }
}
