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
  validateFolderId,
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
  const validation = validateFolderId(name);
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

export function renameFolder(
  projectRoot: string,
  fromId: string,
  toId: string,
) {
  const fromValidation = validateFolderId(fromId);
  if (fromValidation) return { error: fromValidation };
  const toValidation = validateFolderId(toId);
  if (toValidation) return { error: toValidation };
  if (!folderExists(projectRoot, fromId)) {
    return { error: "フォルダが見つかりません" };
  }
  if (folderExists(projectRoot, toId)) {
    return { error: "同名のフォルダが既に存在します" };
  }
  const from = resolveFolderPath(projectRoot, fromId);
  const to = resolveFolderPath(projectRoot, toId);
  if ("error" in from) return { error: from.error };
  if ("error" in to) return { error: to.error };
  fs.renameSync(from.absolutePath, to.absolutePath);
  return { ok: true as const, newId: toId };
}

export function deleteFolder(projectRoot: string, folderId: string) {
  const validation = validateFolderId(folderId);
  if (validation) return { error: validation };
  if (!folderExists(projectRoot, folderId)) {
    return { error: "フォルダが見つかりません" };
  }
  if (!isFolderEmpty(projectRoot, folderId)) {
    return { error: "空のフォルダのみ削除できます" };
  }
  const resolved = resolveFolderPath(projectRoot, folderId);
  if ("error" in resolved) return { error: resolved.error };
  fs.rmdirSync(resolved.absolutePath);
  return { ok: true as const };
}

export function createFile(
  projectRoot: string,
  folderId: string,
  fileName: string,
  content = "",
) {
  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };
  if (!folderExists(projectRoot, folderId)) {
    return { error: "フォルダが見つかりません" };
  }
  const resolved = resolveFilePath(projectRoot, folderId, fileName);
  if ("error" in resolved) return { error: resolved.error };
  if (fs.existsSync(resolved.absolutePath)) {
    return { error: "同名のファイルが既に存在します" };
  }
  fs.writeFileSync(resolved.absolutePath, content, "utf-8");
  return { ok: true as const };
}

export function renameFile(
  projectRoot: string,
  folderId: string,
  fromName: string,
  toName: string,
) {
  const fromValidation = validateFileName(fromName);
  if (fromValidation) return { error: fromValidation };
  const toValidation = validateFileName(toName);
  if (toValidation) return { error: toValidation };
  const from = resolveFilePath(projectRoot, folderId, fromName);
  const to = resolveFilePath(projectRoot, folderId, toName);
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
  folderId: string,
  fileName: string,
) {
  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };
  const resolved = resolveFilePath(projectRoot, folderId, fileName);
  if ("error" in resolved) return { error: resolved.error };
  if (!fs.existsSync(resolved.absolutePath)) {
    return { error: "ファイルが見つかりません" };
  }
  fs.unlinkSync(resolved.absolutePath);
  return { ok: true as const };
}

export function saveFile(
  projectRoot: string,
  folderId: string,
  fileName: string,
  content: string,
) {
  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };
  if (!folderExists(projectRoot, folderId)) {
    return { error: "フォルダが見つかりません" };
  }
  const resolved = resolveFilePath(projectRoot, folderId, fileName);
  if ("error" in resolved) return { error: resolved.error };
  fs.writeFileSync(resolved.absolutePath, content, "utf-8");
  return { ok: true as const };
}

export function readFileContent(
  projectRoot: string,
  folderId: string,
  fileName: string,
): { content: string } | { error: string } {
  const fileValidation = validateFileName(fileName);
  if (fileValidation) return { error: fileValidation };
  const resolved = resolveFilePath(projectRoot, folderId, fileName);
  if ("error" in resolved) return { error: resolved.error };
  if (!fs.existsSync(resolved.absolutePath)) {
    return { error: "ファイルが見つかりません" };
  }
  return { content: fs.readFileSync(resolved.absolutePath, "utf-8") };
}

export function listFolderFiles(projectRoot: string, folderId: string): string[] {
  const resolved = resolveFolderPath(projectRoot, folderId);
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

export function readFolderTextSample(
  projectRoot: string,
  folderId: string,
  maxChars = 2000,
): string {
  const files = listFolderFiles(projectRoot, folderId);
  let sample = "";
  for (const file of files) {
    const result = readFileContent(projectRoot, folderId, file);
    if ("error" in result) continue;
    sample += `\n# ${file}\n${result.content.slice(0, 500)}\n`;
    if (sample.length >= maxChars) break;
  }
  return sample.trim();
}

export { SESSION_FILENAME };
