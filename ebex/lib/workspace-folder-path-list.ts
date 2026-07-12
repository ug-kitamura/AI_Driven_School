import { resolveFileIconCategory } from "@/lib/workspace-file-icon";
import { collectFolderFilesRecursive } from "@/lib/workspace-mutations";
import { resolveFolderPath, SESSION_FILENAME } from "@/lib/workspace-paths";

export const FOLDER_NAME_MAX_PATHS = 80;
export const FOLDER_NAME_MAX_PATH_CHARS = 2000;

function isExcludedForNaming(fileName: string): boolean {
  if (fileName === SESSION_FILENAME) return true;
  if (fileName.startsWith(".")) return true;
  return resolveFileIconCategory(fileName) === "secret";
}

/** AI フォルダ命名用の相対パス一覧（本文は読まない） */
export function listFolderRelativePathsForNaming(
  projectRoot: string,
  folderPath: string,
  options?: { maxPaths?: number; maxChars?: number },
): string[] {
  const resolved = resolveFolderPath(projectRoot, folderPath);
  if ("error" in resolved) return [];

  const maxPaths = options?.maxPaths ?? FOLDER_NAME_MAX_PATHS;
  const maxChars = options?.maxChars ?? FOLDER_NAME_MAX_PATH_CHARS;
  const files = collectFolderFilesRecursive(resolved.absolutePath);
  const paths = files
    .filter((file) => !isExcludedForNaming(file.fileName))
    .map((file) =>
      file.folderPath ? `${file.folderPath}/${file.fileName}` : file.fileName,
    )
    .sort((a, b) => a.localeCompare(b, "ja"));

  const selected: string[] = [];
  let chars = 0;
  for (const relative of paths) {
    if (selected.length >= maxPaths) break;
    const next = chars === 0 ? relative.length : chars + 1 + relative.length;
    if (next > maxChars) break;
    selected.push(relative);
    chars = next;
  }
  return selected;
}
