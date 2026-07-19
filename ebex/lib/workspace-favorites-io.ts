import fs from "node:fs";
import { folderExists, resolveFilePath } from "@/lib/workspace-paths";
import { getProjectFolderId } from "@/lib/workspace-path-utils";
import {
  buildLiveInoMap,
  findRegistryEntryByPath,
  readStoredFavorites,
  resolveProjectIno,
  writeStoredFavorites,
  type StoredFavoriteEntry,
} from "@/lib/workspace-meta";
import { dedupeFavorites, type FavoriteEntry } from "@/lib/workspace-favorites";

/**
 * 保存形式は `.meta/favorites.json` の `{ ino, fileName }`（fileName はプロジェクト
 * フォルダ内相対パス）。API・UI へは従来どおり `{ folderPath, fileName }` で受け渡し、
 * 変換はこの層に閉じる。ino キーのためプロジェクトフォルダのリネームでは更新不要。
 */

function toStoredKey(
  projectRoot: string,
  folderPath: string,
  fileName: string,
): StoredFavoriteEntry | null {
  const top = getProjectFolderId(folderPath);
  const resolved = resolveProjectIno(projectRoot, top);
  if ("error" in resolved) return null;
  const subPath = folderPath.slice(top.length + 1);
  return {
    ino: resolved.ino,
    fileName: subPath ? `${subPath}/${fileName}` : fileName,
  };
}

function toFavoriteEntry(
  stored: StoredFavoriteEntry,
  liveInoMap: Map<string, string>,
): FavoriteEntry | null {
  const top = liveInoMap.get(stored.ino);
  if (!top) return null;
  const slash = stored.fileName.lastIndexOf("/");
  if (slash < 0) {
    return { folderPath: top, fileName: stored.fileName };
  }
  return {
    folderPath: `${top}/${stored.fileName.slice(0, slash)}`,
    fileName: stored.fileName.slice(slash + 1),
  };
}

export function readFavorites(projectRoot: string): FavoriteEntry[] {
  const stored = readStoredFavorites(projectRoot);
  if (stored.length === 0) return [];
  const liveInoMap = buildLiveInoMap(projectRoot);
  const favorites: FavoriteEntry[] = [];
  for (const entry of stored) {
    const favorite = toFavoriteEntry(entry, liveInoMap);
    if (favorite) favorites.push(favorite);
  }
  return dedupeFavorites(favorites);
}

export function toggleFavorite(
  projectRoot: string,
  folderPath: string,
  fileName: string,
): FavoriteEntry[] {
  const key = toStoredKey(projectRoot, folderPath, fileName);
  if (!key) return readFavorites(projectRoot);

  const stored = readStoredFavorites(projectRoot);
  const index = stored.findIndex(
    (entry) => entry.ino === key.ino && entry.fileName === key.fileName,
  );
  if (index >= 0) {
    stored.splice(index, 1);
  } else {
    stored.push(key);
  }
  writeStoredFavorites(projectRoot, stored);
  return readFavorites(projectRoot);
}

export function renameFavoriteFile(
  projectRoot: string,
  folderPath: string,
  fromName: string,
  toName: string,
): void {
  const fromKey = toStoredKey(projectRoot, folderPath, fromName);
  const toKey = toStoredKey(projectRoot, folderPath, toName);
  if (!fromKey || !toKey) return;

  const stored = readStoredFavorites(projectRoot);
  let changed = false;
  for (const entry of stored) {
    if (entry.ino === fromKey.ino && entry.fileName === fromKey.fileName) {
      entry.fileName = toKey.fileName;
      changed = true;
    }
  }
  if (changed) writeStoredFavorites(projectRoot, stored);
}

/**
 * フォルダリネーム時の追従。プロジェクトフォルダ（トップレベル）のリネームは
 * ino キーのため保存データの更新は不要。サブフォルダのリネームは fileName の
 * 相対パス接頭辞を付け替える。
 */
export function remapFavoritesOnFolderRename(
  projectRoot: string,
  fromPath: string,
  toPath: string,
): void {
  if (!fromPath.includes("/")) return;

  const fromTop = getProjectFolderId(fromPath);
  const toTop = getProjectFolderId(toPath);
  if (fromTop !== toTop) return;

  const resolved = resolveProjectIno(projectRoot, fromTop);
  if ("error" in resolved) return;

  const fromPrefix = `${fromPath.slice(fromTop.length + 1)}/`;
  const toPrefix = `${toPath.slice(toTop.length + 1)}/`;
  const stored = readStoredFavorites(projectRoot);
  let changed = false;
  for (const entry of stored) {
    if (entry.ino !== resolved.ino) continue;
    if (!entry.fileName.startsWith(fromPrefix)) continue;
    entry.fileName = `${toPrefix}${entry.fileName.slice(fromPrefix.length)}`;
    changed = true;
  }
  if (changed) writeStoredFavorites(projectRoot, stored);
}

export function removeFavoriteFile(
  projectRoot: string,
  folderPath: string,
  fileName: string,
): void {
  const key = toStoredKey(projectRoot, folderPath, fileName);
  if (!key) return;
  const stored = readStoredFavorites(projectRoot);
  const next = stored.filter(
    (entry) => !(entry.ino === key.ino && entry.fileName === key.fileName),
  );
  if (next.length !== stored.length) {
    writeStoredFavorites(projectRoot, next);
  }
}

/**
 * フォルダ削除時の掃除。プロジェクトフォルダ削除は削除後に呼ばれるため
 * stat できず、台帳（folderPath 予備キー）から ino を引く。
 */
export function removeFavoritesUnderPath(
  projectRoot: string,
  folderPath: string,
): void {
  const top = getProjectFolderId(folderPath);

  if (!folderPath.includes("/")) {
    const entry = findRegistryEntryByPath(projectRoot, top);
    if (!entry) return;
    const stored = readStoredFavorites(projectRoot);
    const next = stored.filter((item) => item.ino !== entry.ino);
    if (next.length !== stored.length) {
      writeStoredFavorites(projectRoot, next);
    }
    return;
  }

  const resolved = resolveProjectIno(projectRoot, top);
  if ("error" in resolved) return;
  const prefix = `${folderPath.slice(top.length + 1)}/`;
  const stored = readStoredFavorites(projectRoot);
  const next = stored.filter(
    (item) =>
      !(item.ino === resolved.ino && item.fileName.startsWith(prefix)),
  );
  if (next.length !== stored.length) {
    writeStoredFavorites(projectRoot, next);
  }
}

export function filterFavoritesToFilesystem(
  projectRoot: string,
  favorites: FavoriteEntry[],
): FavoriteEntry[] {
  return favorites.filter((entry) => {
    if (!folderExists(projectRoot, entry.folderPath)) return false;
    const resolved = resolveFilePath(
      projectRoot,
      entry.folderPath,
      entry.fileName,
    );
    if ("error" in resolved) return false;
    return fs.existsSync(resolved.absolutePath);
  });
}
