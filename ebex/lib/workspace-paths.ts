import fs from "node:fs";
import path from "node:path";

export const WORKSPACE_DIR_NAME = "workspace";
export const SESSION_FILENAME = "session.json";
export const PURPOSE_FILENAME = "purpose.md";

const INVALID_NAME_RE = /[\\/:*?"<>|]/;

export function getWorkspaceDir(projectRoot: string): string {
  return path.join(projectRoot, WORKSPACE_DIR_NAME);
}

export function validateFolderId(folderId: string): string | null {
  const trimmed = folderId.trim();
  if (!trimmed) return "フォルダ名が空です";
  if (trimmed.includes("..")) return "不正なフォルダ名です";
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    return "不正なフォルダ名です";
  }
  if (INVALID_NAME_RE.test(trimmed)) return "不正なフォルダ名です";
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

export function resolveFolderPath(
  projectRoot: string,
  folderId: string,
): { absolutePath: string } | { error: string } {
  const validation = validateFolderId(folderId);
  if (validation) return { error: validation };

  const workspaceDir = path.resolve(getWorkspaceDir(projectRoot));
  const absolutePath = path.resolve(workspaceDir, folderId);
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
  folderId: string,
  fileName: string,
): { absolutePath: string; folderPath: string } | { error: string } {
  const folder = resolveFolderPath(projectRoot, folderId);
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

export function folderExists(projectRoot: string, folderId: string): boolean {
  const resolved = resolveFolderPath(projectRoot, folderId);
  if ("error" in resolved) return false;
  return fs.existsSync(resolved.absolutePath);
}

export function isFolderEmpty(projectRoot: string, folderId: string): boolean {
  const resolved = resolveFolderPath(projectRoot, folderId);
  if ("error" in resolved) return false;
  if (!fs.existsSync(resolved.absolutePath)) return false;
  return fs.readdirSync(resolved.absolutePath).length === 0;
}

export function folderHasSubfolders(
  projectRoot: string,
  folderId: string,
): boolean {
  const resolved = resolveFolderPath(projectRoot, folderId);
  if ("error" in resolved) return false;
  if (!fs.existsSync(resolved.absolutePath)) return false;
  return fs
    .readdirSync(resolved.absolutePath, { withFileTypes: true })
    .some((entry) => entry.isDirectory());
}
