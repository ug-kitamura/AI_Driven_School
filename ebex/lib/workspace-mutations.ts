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
) {
  const parentValidation = validateRelativeFolderPath(parentPath);
  if (parentValidation) return { error: parentValidation };
  const nameValidation = validateFolderSegment(name);
  if (nameValidation) return { error: nameValidation };
  if (!folderExists(projectRoot, parentPath)) {
    return { error: "親フォルダが見つかりません" };
  }

  const childPath = `${parentPath}/${name}`;
  if (folderExists(projectRoot, childPath)) {
    return { error: "同名のフォルダが既に存在します" };
  }

  const resolved = resolveFolderPath(projectRoot, childPath);
  if ("error" in resolved) return { error: resolved.error };
  fs.mkdirSync(resolved.absolutePath, { recursive: true });
  return { ok: true as const, path: childPath };
}

export function renameFolder(
  projectRoot: string,
  fromPath: string,
  toPath: string,
) {
  const fromValidation = validateRelativeFolderPath(fromPath);
  if (fromValidation) return { error: fromValidation };
  const toValidation = validateRelativeFolderPath(toPath);
  if (toValidation) return { error: toValidation };
  if (!folderExists(projectRoot, fromPath)) {
    return { error: "フォルダが見つかりません" };
  }
  if (folderExists(projectRoot, toPath)) {
    return { error: "同名のフォルダが既に存在します" };
  }
  const from = resolveFolderPath(projectRoot, fromPath);
  const to = resolveFolderPath(projectRoot, toPath);
  if ("error" in from) return { error: from.error };
  if ("error" in to) return { error: to.error };
  fs.renameSync(from.absolutePath, to.absolutePath);
  return { ok: true as const, newPath: toPath };
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
  return { ok: true as const };
}

export function moveFile(
  projectRoot: string,
  fromFolderId: string,
  fromName: string,
  toFolderId: string,
  toName?: string,
) {
  const targetName = toName ?? fromName;
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
    return { error: "同名のファイルが既に存在します" };
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
  const baseName = toName ?? getFolderBaseName(fromPath);
  const nameValidation = validateFolderSegment(baseName);
  if (nameValidation) return { error: nameValidation };
  const toPath = `${toParentPath}/${baseName}`;
  if (folderExists(projectRoot, toPath)) {
    return { error: "同名のフォルダが既に存在します" };
  }
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
) {
  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };
  if (!folderExists(projectRoot, folderPath)) {
    return { error: "フォルダが見つかりません" };
  }
  const resolved = resolveFilePath(projectRoot, folderPath, fileName);
  if ("error" in resolved) return { error: resolved.error };
  if (fs.existsSync(resolved.absolutePath)) {
    return { error: "同名のファイルが既に存在します" };
  }
  fs.writeFileSync(resolved.absolutePath, content, "utf-8");
  return { ok: true as const };
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

function collectFolderFilesRecursive(
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

export function readFolderTextSample(
  projectRoot: string,
  folderPath: string,
  maxChars = 2000,
): string {
  const resolved = resolveFolderPath(projectRoot, folderPath);
  if ("error" in resolved) return "";
  const files = collectFolderFilesRecursive(resolved.absolutePath);
  let sample = "";
  for (const file of files) {
    const absoluteFolderPath = file.folderPath
      ? path.join(resolved.absolutePath, file.folderPath)
      : resolved.absolutePath;
    const absoluteFilePath = path.join(absoluteFolderPath, file.fileName);
    if (!fs.existsSync(absoluteFilePath)) continue;
    const relativePath = file.folderPath
      ? `${file.folderPath}/${file.fileName}`
      : file.fileName;
    const content = fs.readFileSync(absoluteFilePath, "utf-8");
    sample += `\n# ${relativePath}\n${content.slice(0, 500)}\n`;
    if (sample.length >= maxChars) break;
  }
  return sample.trim();
}

export { SESSION_FILENAME };
