import fs from "node:fs";
import path from "node:path";
import {
  SESSION_FILENAME,
  WORKSPACE_DIR_NAME,
  validateFileName,
  validateRelativeFolderPath,
} from "@/lib/workspace-path-utils";

export {
  PURPOSE_FILENAME,
  SESSION_FILENAME,
  WORKSPACE_DIR_NAME,
  getProjectFolderId,
  validateFileName,
  validateFolderId,
  validateFolderSegment,
  validateRelativeFolderPath,
} from "@/lib/workspace-path-utils";

export function getWorkspaceDir(projectRoot: string): string {
  return path.join(projectRoot, WORKSPACE_DIR_NAME);
}

export function resolveFolderPath(
  projectRoot: string,
  folderPath: string,
): { absolutePath: string } | { error: string } {
  const validation = validateRelativeFolderPath(folderPath);
  if (validation) return { error: validation };

  const workspaceDir = path.resolve(getWorkspaceDir(projectRoot));
  const absolutePath = path.resolve(workspaceDir, folderPath);
  if (
    !absolutePath.startsWith(workspaceDir + path.sep) &&
    absolutePath !== workspaceDir
  ) {
    return { error: "不正なフォルダパスです" };
  }
  return { absolutePath };
}

export function resolveFilePath(
  projectRoot: string,
  folderPath: string,
  fileName: string,
): { absolutePath: string; folderPath: string } | { error: string } {
  const folder = resolveFolderPath(projectRoot, folderPath);
  if ("error" in folder) return folder;

  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };

  return {
    folderPath: folder.absolutePath,
    absolutePath: path.join(folder.absolutePath, fileName),
  };
}

export function ensureWorkspaceDir(projectRoot: string): string {
  const dir = getWorkspaceDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function folderExists(projectRoot: string, folderPath: string): boolean {
  const resolved = resolveFolderPath(projectRoot, folderPath);
  if ("error" in resolved) return false;
  return fs.existsSync(resolved.absolutePath);
}

export function isFolderEmpty(projectRoot: string, folderPath: string): boolean {
  const resolved = resolveFolderPath(projectRoot, folderPath);
  if ("error" in resolved) return false;
  if (!fs.existsSync(resolved.absolutePath)) return false;
  const entries = fs.readdirSync(resolved.absolutePath);
  if (entries.length === 0) return true;
  return entries.length === 1 && entries[0] === SESSION_FILENAME;
}
