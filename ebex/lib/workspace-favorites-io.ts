import fs from "node:fs";
import path from "node:path";
import { remapFolderPath } from "@/lib/workspace-tree";
import { folderExists, resolveFilePath } from "@/lib/workspace-paths";
import {
  FAVORITES_FILENAME,
  dedupeFavorites,
  favoriteKey,
  type FavoriteEntry,
} from "@/lib/workspace-favorites";

type FavoritesFile = {
  favorites: FavoriteEntry[];
};

function favoritesPath(projectRoot: string): string {
  return path.join(projectRoot, FAVORITES_FILENAME);
}

export function readFavorites(projectRoot: string): FavoriteEntry[] {
  const filePath = favoritesPath(projectRoot);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as FavoritesFile;
    if (!Array.isArray(parsed.favorites)) return [];
    return dedupeFavorites(parsed.favorites);
  } catch {
    return [];
  }
}

export function writeFavorites(
  projectRoot: string,
  favorites: FavoriteEntry[],
): void {
  const filePath = favoritesPath(projectRoot);
  const payload: FavoritesFile = { favorites: dedupeFavorites(favorites) };
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

export function toggleFavorite(
  projectRoot: string,
  folderPath: string,
  fileName: string,
): FavoriteEntry[] {
  const favorites = readFavorites(projectRoot);
  const key = `${folderPath}/${fileName}`;
  const index = favorites.findIndex((entry) => favoriteKey(entry) === key);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push({ folderPath, fileName });
  }
  writeFavorites(projectRoot, favorites);
  return favorites;
}

export function renameFavoriteFile(
  projectRoot: string,
  folderPath: string,
  fromName: string,
  toName: string,
): void {
  const favorites = readFavorites(projectRoot);
  let changed = false;
  for (const entry of favorites) {
    if (entry.folderPath === folderPath && entry.fileName === fromName) {
      entry.fileName = toName;
      changed = true;
    }
  }
  if (changed) writeFavorites(projectRoot, favorites);
}

export function remapFavoritesOnFolderRename(
  projectRoot: string,
  fromPath: string,
  toPath: string,
): void {
  const favorites = readFavorites(projectRoot);
  let changed = false;
  for (const entry of favorites) {
    const nextPath = remapFolderPath(entry.folderPath, fromPath, toPath);
    if (nextPath !== entry.folderPath) {
      entry.folderPath = nextPath;
      changed = true;
    }
  }
  if (changed) writeFavorites(projectRoot, dedupeFavorites(favorites));
}

export function removeFavoriteFile(
  projectRoot: string,
  folderPath: string,
  fileName: string,
): void {
  const favorites = readFavorites(projectRoot);
  const next = favorites.filter(
    (entry) =>
      !(entry.folderPath === folderPath && entry.fileName === fileName),
  );
  if (next.length !== favorites.length) {
    writeFavorites(projectRoot, next);
  }
}

export function removeFavoritesUnderPath(
  projectRoot: string,
  folderPath: string,
): void {
  const favorites = readFavorites(projectRoot);
  const next = favorites.filter(
    (entry) =>
      entry.folderPath !== folderPath &&
      !entry.folderPath.startsWith(`${folderPath}/`),
  );
  if (next.length !== favorites.length) {
    writeFavorites(projectRoot, next);
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
