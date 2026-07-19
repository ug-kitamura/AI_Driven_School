import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  ensureWorkspaceDir,
  folderExists,
  isFolderEmpty,
  resolveFilePath,
  resolveFolderPath,
  validateFileName,
  validateFolderSegment,
  validateRelativeFolderPath,
  SESSION_FILENAME,
} from "@/lib/workspace-paths";
import {
  resolveUniqueFileName,
  resolveUniqueFolderName,
} from "@/lib/workspace-unique-name";
import { getParentFolderPath } from "@/lib/workspace-tree-path";
import {
  remapFavoritesOnFolderRename,
  removeFavoriteFile,
  removeFavoritesUnderPath,
  renameFavoriteFile,
} from "@/lib/workspace-favorites-io";
import {
  onProjectFolderDeleted,
  onProjectFolderRenamed,
} from "@/lib/workspace-meta";
import {
  diagnoseRenameFailure,
  errorCodeOf,
} from "@/lib/rename-diagnostics";

export type ConflictPolicy = "error" | "auto-rename";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function readJsonBody<T>(
  _req: Request,
  _schema: z.ZodType<T>,
): never {
  throw new Error("Use parseJsonBody instead");
}

export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { error: Response }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: jsonError("Invalid JSON body", 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      error: jsonError(
        parsed.error.issues[0]?.message ?? "Invalid request body",
        400,
      ),
    };
  }
  return { data: parsed.data };
}

export function createFolder(projectRoot: string, name: string) {
  const validation = validateFolderSegment(name);
  if (validation) return { error: validation };
  if (folderExists(projectRoot, name)) {
    return { error: "同名のフォルダが既に存在します" };
  }
  ensureWorkspaceDir(projectRoot);
  const resolved = resolveFolderPath(projectRoot, name);
  if ("error" in resolved) return { error: resolved.error };
  fs.mkdirSync(resolved.absolutePath, { recursive: true });
  return { ok: true as const };
}

export function createSubFolder(
  projectRoot: string,
  parentPath: string,
  name: string,
  conflictPolicy: ConflictPolicy = "error",
) {
  const parentValidation = validateRelativeFolderPath(parentPath);
  if (parentValidation) return { error: parentValidation };
  let finalName = name;
  const nameValidation = validateFolderSegment(finalName);
  if (nameValidation) return { error: nameValidation };
  if (!folderExists(projectRoot, parentPath)) {
    return { error: "親フォルダが見つかりません" };
  }

  const childPath = `${parentPath}/${finalName}`;
  if (folderExists(projectRoot, childPath)) {
    if (conflictPolicy === "error") {
      return { error: "同名のフォルダが既に存在します" };
    }
    finalName = resolveUniqueFolderName(
      listFolderSubfolderNames(projectRoot, parentPath),
      finalName,
    );
  }
  const resolvedChildPath = `${parentPath}/${finalName}`;

  const resolved = resolveFolderPath(projectRoot, resolvedChildPath);
  if ("error" in resolved) return { error: resolved.error };
  fs.mkdirSync(resolved.absolutePath, { recursive: true });
  return { ok: true as const, path: resolvedChildPath };
}

export function renameFolder(
  projectRoot: string,
  fromPath: string,
  toPath: string,
  conflictPolicy: ConflictPolicy = "error",
) {
  const fromValidation = validateRelativeFolderPath(fromPath);
  if (fromValidation) return { error: fromValidation };
  let finalToPath = toPath;
  const toValidation = validateRelativeFolderPath(finalToPath);
  if (toValidation) return { error: toValidation };
  if (!folderExists(projectRoot, fromPath)) {
    return { error: "フォルダが見つかりません" };
  }
  if (folderExists(projectRoot, finalToPath)) {
    if (conflictPolicy === "error") {
      return { error: "同名のフォルダが既に存在します" };
    }
    const parentPath = getParentFolderPath(finalToPath);
    const baseName = getFolderBaseName(finalToPath);
    if (!parentPath) {
      return { error: "同名のフォルダが既に存在します" };
    }
    const uniqueName = resolveUniqueFolderName(
      listFolderSubfolderNames(projectRoot, parentPath),
      baseName,
    );
    finalToPath = `${parentPath}/${uniqueName}`;
  }
  const from = resolveFolderPath(projectRoot, fromPath);
  const to = resolveFolderPath(projectRoot, finalToPath);
  if ("error" in from) return { error: from.error };
  if ("error" in to) return { error: to.error };
  try {
    fs.renameSync(from.absolutePath, to.absolutePath);
  } catch (error) {
    const code = errorCodeOf(error);
    diagnoseRenameFailure(projectRoot, {
      fromPath,
      toPath: finalToPath,
      fromAbsolutePath: from.absolutePath,
      toAbsolutePath: to.absolutePath,
      error,
    });
    return {
      error: `フォルダ名の変更に失敗しました（${code}）。診断情報を workspace/.meta/diagnostics.log に記録しました`,
    };
  }
  onProjectFolderRenamed(projectRoot, fromPath, finalToPath);
  remapFavoritesOnFolderRename(projectRoot, fromPath, finalToPath);
  return { ok: true as const, newPath: finalToPath };
}

export function deleteFolder(projectRoot: string, folderPath: string) {
  const validation = validateRelativeFolderPath(folderPath);
  if (validation) return { error: validation };
  if (!folderExists(projectRoot, folderPath)) {
    return { error: "フォルダが見つかりません" };
  }
  const isSubfolder = folderPath.includes("/");
  if (!isSubfolder && !isFolderEmpty(projectRoot, folderPath)) {
    return { error: "空のフォルダのみ削除できます" };
  }
  const resolved = resolveFolderPath(projectRoot, folderPath);
  if ("error" in resolved) return { error: resolved.error };
  fs.rmSync(resolved.absolutePath, { recursive: true, force: true });
  // 台帳エントリを参照するため、お気に入り掃除 → 台帳・セッション掃除の順で行う
  removeFavoritesUnderPath(projectRoot, folderPath);
  onProjectFolderDeleted(projectRoot, folderPath);
  return { ok: true as const };
}

export function listFolderSubfolderNames(
  projectRoot: string,
  folderPath: string,
): string[] {
  const resolved = resolveFolderPath(projectRoot, folderPath);
  if ("error" in resolved) return [];
  if (!fs.existsSync(resolved.absolutePath)) return [];
  return fs
    .readdirSync(resolved.absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

export function moveFile(
  projectRoot: string,
  fromFolderId: string,
  fromName: string,
  toFolderId: string,
  toName?: string,
  conflictPolicy: ConflictPolicy = "error",
) {
  let targetName = toName ?? fromName;
  const fromValidation = validateFileName(fromName);
  if (fromValidation) return { error: fromValidation };
  const toValidation = validateFileName(targetName);
  if (toValidation) return { error: toValidation };
  const fromFolderValidation = validateRelativeFolderPath(fromFolderId);
  if (fromFolderValidation) return { error: fromFolderValidation };
  const toFolderValidation = validateRelativeFolderPath(toFolderId);
  if (toFolderValidation) return { error: toFolderValidation };
  if (!folderExists(projectRoot, fromFolderId)) {
    return { error: "フォルダが見つかりません" };
  }
  if (!folderExists(projectRoot, toFolderId)) {
    return { error: "フォルダが見つかりません" };
  }
  const from = resolveFilePath(projectRoot, fromFolderId, fromName);
  const to = resolveFilePath(projectRoot, toFolderId, targetName);
  if ("error" in from) return { error: from.error };
  if ("error" in to) return { error: to.error };
  if (!fs.existsSync(from.absolutePath)) {
    return { error: "ファイルが見つかりません" };
  }
  if (fs.existsSync(to.absolutePath)) {
    if (conflictPolicy === "error") {
      return { error: "同名のファイルが既に存在します" };
    }
    targetName = resolveUniqueFileName(
      listFolderFiles(projectRoot, toFolderId),
      targetName,
    );
    const resolvedUnique = resolveFilePath(projectRoot, toFolderId, targetName);
    if ("error" in resolvedUnique) return { error: resolvedUnique.error };
    fs.renameSync(from.absolutePath, resolvedUnique.absolutePath);
    return { ok: true as const, newName: targetName };
  }
  fs.renameSync(from.absolutePath, to.absolutePath);
  return { ok: true as const, newName: targetName };
}

function shouldSkipCopyEntry(name: string): boolean {
  return name.startsWith(".") || name === SESSION_FILENAME;
}

export function copyFolder(
  projectRoot: string,
  fromPath: string,
  toParentPath: string,
  toName?: string,
  conflictPolicy: ConflictPolicy = "error",
) {
  const fromValidation = validateRelativeFolderPath(fromPath);
  if (fromValidation) return { error: fromValidation };
  const parentValidation = validateRelativeFolderPath(toParentPath);
  if (parentValidation) return { error: parentValidation };
  if (!folderExists(projectRoot, fromPath)) {
    return { error: "フォルダが見つかりません" };
  }
  if (!folderExists(projectRoot, toParentPath)) {
    return { error: "親フォルダが見つかりません" };
  }
  let baseName = toName ?? getFolderBaseName(fromPath);
  const nameValidation = validateFolderSegment(baseName);
  if (nameValidation) return { error: nameValidation };
  if (folderExists(projectRoot, `${toParentPath}/${baseName}`)) {
    if (conflictPolicy === "error") {
      return { error: "同名のフォルダが既に存在します" };
    }
    baseName = resolveUniqueFolderName(
      listFolderSubfolderNames(projectRoot, toParentPath),
      baseName,
    );
  }
  const toPath = `${toParentPath}/${baseName}`;
  const from = resolveFolderPath(projectRoot, fromPath);
  const to = resolveFolderPath(projectRoot, toPath);
  if ("error" in from) return { error: from.error };
  if ("error" in to) return { error: to.error };
  fs.cpSync(from.absolutePath, to.absolutePath, {
    recursive: true,
    filter: (src) => !shouldSkipCopyEntry(path.basename(src)),
  });
  return { ok: true as const, path: toPath };
}

function getFolderBaseName(folderPath: string): string {
  const idx = folderPath.lastIndexOf("/");
  return idx >= 0 ? folderPath.slice(idx + 1) : folderPath;
}

export function createFile(
  projectRoot: string,
  folderPath: string,
  fileName: string,
  content = "",
  conflictPolicy: ConflictPolicy = "error",
) {
  let finalName = fileName;
  const fileValidation = validateFileName(finalName);
  if (fileValidation) return { error: fileValidation };
  if (!folderExists(projectRoot, folderPath)) {
    return { error: "フォルダが見つかりません" };
  }
  const resolved = resolveFilePath(projectRoot, folderPath, finalName);
  if ("error" in resolved) return { error: resolved.error };
  if (fs.existsSync(resolved.absolutePath)) {
    if (conflictPolicy === "error") {
      return { error: "同名のファイルが既に存在します" };
    }
    finalName = resolveUniqueFileName(
      listFolderFiles(projectRoot, folderPath),
      finalName,
    );
  }
  const finalResolved = resolveFilePath(projectRoot, folderPath, finalName);
  if ("error" in finalResolved) return { error: finalResolved.error };
  fs.writeFileSync(finalResolved.absolutePath, content, "utf-8");
  return { ok: true as const, fileName: finalName };
}

export function renameFile(
  projectRoot: string,
  folderPath: string,
  fromName: string,
  toName: string,
) {
  const fromValidation = validateFileName(fromName);
  if (fromValidation) return { error: fromValidation };
  const toValidation = validateFileName(toName);
  if (toValidation) return { error: toValidation };
  const from = resolveFilePath(projectRoot, folderPath, fromName);
  const to = resolveFilePath(projectRoot, folderPath, toName);
  if ("error" in from) return { error: from.error };
  if ("error" in to) return { error: to.error };
  if (!fs.existsSync(from.absolutePath)) {
    return { error: "ファイルが見つかりません" };
  }
  if (fs.existsSync(to.absolutePath)) {
    return { error: "同名のファイルが既に存在します" };
  }
  fs.renameSync(from.absolutePath, to.absolutePath);
  renameFavoriteFile(projectRoot, folderPath, fromName, toName);
  return { ok: true as const, newName: toName };
}

export function deleteFile(
  projectRoot: string,
  folderPath: string,
  fileName: string,
) {
  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };
  const resolved = resolveFilePath(projectRoot, folderPath, fileName);
  if ("error" in resolved) return { error: resolved.error };
  if (!fs.existsSync(resolved.absolutePath)) {
    return { error: "ファイルが見つかりません" };
  }
  fs.unlinkSync(resolved.absolutePath);
  removeFavoriteFile(projectRoot, folderPath, fileName);
  return { ok: true as const };
}

export function saveFile(
  projectRoot: string,
  folderPath: string,
  fileName: string,
  content: string,
) {
  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };
  if (!folderExists(projectRoot, folderPath)) {
    return { error: "フォルダが見つかりません" };
  }
  const resolved = resolveFilePath(projectRoot, folderPath, fileName);
  if ("error" in resolved) return { error: resolved.error };
  fs.writeFileSync(resolved.absolutePath, content, "utf-8");
  return { ok: true as const };
}

export function readFileContent(
  projectRoot: string,
  folderPath: string,
  fileName: string,
): { content: string } | { error: string } {
  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };
  const resolved = resolveFilePath(projectRoot, folderPath, fileName);
  if ("error" in resolved) return { error: resolved.error };
  if (!fs.existsSync(resolved.absolutePath)) {
    return { error: "ファイルが見つかりません" };
  }
  return { content: fs.readFileSync(resolved.absolutePath, "utf-8") };
}

export function readFileBinary(
  projectRoot: string,
  folderPath: string,
  fileName: string,
): { buffer: Buffer; absolutePath: string } | { error: string } {
  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };
  const resolved = resolveFilePath(projectRoot, folderPath, fileName);
  if ("error" in resolved) return { error: resolved.error };
  if (!fs.existsSync(resolved.absolutePath)) {
    return { error: "ファイルが見つかりません" };
  }
  return {
    buffer: fs.readFileSync(resolved.absolutePath),
    absolutePath: resolved.absolutePath,
  };
}

export function listFolderFiles(projectRoot: string, folderPath: string): string[] {
  const resolved = resolveFolderPath(projectRoot, folderPath);
  if ("error" in resolved) return [];
  if (!fs.existsSync(resolved.absolutePath)) return [];
  return fs
    .readdirSync(resolved.absolutePath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name !== SESSION_FILENAME &&
        !entry.name.startsWith("."),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

export function collectFolderFilesRecursive(
  absoluteDir: string,
): Array<{ fileName: string; folderPath: string }> {
  const results: Array<{ fileName: string; folderPath: string }> = [];
  if (!fs.existsSync(absoluteDir)) return results;

  function walk(currentAbs: string, currentRel: string) {
    for (const entry of fs.readdirSync(currentAbs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const entryAbs = path.join(currentAbs, entry.name);
      const entryRel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(entryAbs, entryRel);
        continue;
      }
      if (entry.isFile() && entry.name !== SESSION_FILENAME) {
        const slash = entryRel.lastIndexOf("/");
        if (slash === -1) {
          results.push({ folderPath: currentRel, fileName: entry.name });
        } else {
          results.push({
            folderPath: entryRel.slice(0, slash),
            fileName: entry.name,
          });
        }
      }
    }
  }

  walk(absoluteDir, "");
  return results;
}

export { SESSION_FILENAME };
