import { STORAGE_KEYS } from "@/lib/storage-keys";

export type LastFileSelection = {
  folderId: string;
  fileName: string;
};

export function loadLastFileSelection(): LastFileSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.lastFile);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastFileSelection>;
    if (!parsed.folderId || !parsed.fileName) return null;
    return { folderId: parsed.folderId, fileName: parsed.fileName };
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
