// EBEX からの縮小移植: dx にはお気に入り UI（pane1 ツリー）が無いため、
// workspace-meta が参照する型と定数のみを保持する（filterFavoritesToExisting は
// workspace-tree 依存のため持ち込まない）。
export const FAVORITES_FILENAME = ".ebex-favorites.json";

export type FavoriteEntry = {
  folderPath: string;
  fileName: string;
};

export function favoriteKey(entry: FavoriteEntry): string {
  return `${entry.folderPath}/${entry.fileName}`;
}

export function dedupeFavorites(favorites: FavoriteEntry[]): FavoriteEntry[] {
  const seen = new Set<string>();
  const result: FavoriteEntry[] = [];
  for (const entry of favorites) {
    const key = favoriteKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

export function toFavoriteKeySet(favorites: FavoriteEntry[]): Set<string> {
  return new Set(favorites.map(favoriteKey));
}

/** 指定フォルダ自身または配下（全階層）にあるお気に入りを列挙する */
export function listFavoritesUnderFolder(
  favorites: FavoriteEntry[],
  folderPath: string,
): FavoriteEntry[] {
  if (!folderPath) return [];
  return favorites.filter(
    (entry) =>
      entry.folderPath === folderPath ||
      entry.folderPath.startsWith(`${folderPath}/`),
  );
}
