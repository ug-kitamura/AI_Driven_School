import fs from "node:fs";
import path from "node:path";
import {
  listFolderFiles,
  readFileContent,
} from "@/lib/workspace-mutations";
import {
  resolveFilePath,
  resolveFolderPath,
  validateFolderId,
} from "@/lib/workspace-paths";
import { WORKSPACE_DIR_NAME, ALLOWED_PREFIX } from "@/lib/workspace-constants";

export type WorkspaceFileRef = {
  path: string;
  name: string;
};

const ATTACHMENT_TOKEN_RE = /@((?:workspace\/)[^\s@]+)/g;

export { ALLOWED_PREFIX };

export function extractAttachmentTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const match of text.matchAll(ATTACHMENT_TOKEN_RE)) {
    tokens.add(match[1]);
  }
  return [...tokens];
}

export function isAllowedWorkspacePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!normalized.startsWith(ALLOWED_PREFIX)) return false;
  if (normalized.includes("..")) return false;
  const parts = normalized.slice(ALLOWED_PREFIX.length).split("/");
  if (parts.length !== 2) return false;
  return parts.every((p) => p.length > 0);
}

export function resolveAllowedWorkspacePath(
  projectRoot: string,
  relativePath: string,
): { absolutePath: string; relativePath: string } | { error: string } {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!isAllowedWorkspacePath(normalized)) {
    return { error: `許可されていないパスです: ${relativePath}` };
  }

  const absolutePath = path.resolve(projectRoot, normalized);
  const workspaceDir = path.resolve(projectRoot, WORKSPACE_DIR_NAME);
  if (
    !absolutePath.startsWith(workspaceDir + path.sep) &&
    absolutePath !== workspaceDir
  ) {
    return { error: `許可されていないパスです: ${relativePath}` };
  }
  if (!fs.existsSync(absolutePath)) {
    return { error: `ファイルが見つかりません: ${relativePath}` };
  }

  return {
    absolutePath,
    relativePath: path.relative(projectRoot, absolutePath).replace(/\\/g, "/"),
  };
}

export function listWorkspaceFolderFiles(
  projectRoot: string,
  folderId: string,
): WorkspaceFileRef[] {
  const validation = validateFolderId(folderId);
  if (validation) return [];
  const files = listFolderFiles(projectRoot, folderId);
  return files.map((name) => ({
    name,
    path: `${ALLOWED_PREFIX}${folderId}/${name}`,
  }));
}

export function orderWorkspaceFilesForPicker(
  files: WorkspaceFileRef[],
  current?: string,
): WorkspaceFileRef[] {
  if (!current) return files;
  const idx = files.findIndex((f) => f.path === current);
  if (idx <= 0) return files;
  const next = [...files];
  const [hit] = next.splice(idx, 1);
  next.unshift(hit);
  return next;
}

export function readAttachmentContents(
  projectRoot: string,
  relativePath: string,
): { path: string; content: string } | { error: string } {
  const resolved = resolveAllowedWorkspacePath(projectRoot, relativePath);
  if ("error" in resolved) return resolved;
  const content = fs.readFileSync(resolved.absolutePath, "utf-8");
  return { path: resolved.relativePath, content };
}

export function resolveAttachmentsForMessage(
  projectRoot: string,
  message: string,
): { attachments: Array<{ path: string; content: string }> } | { error: string } {
  const tokens = extractAttachmentTokens(message);
  const attachments: Array<{ path: string; content: string }> = [];
  for (const token of tokens) {
    const result = readAttachmentContents(projectRoot, token);
    if ("error" in result) return { error: result.error };
    attachments.push(result);
  }
  return { attachments };
}

export function enrichUserMessageWithAttachments(
  message: string,
  attachments: Array<{ path: string; content: string }>,
): string {
  if (attachments.length === 0) return message;
  const blocks = attachments.map(
    (file) => `--- File: ${file.path} ---\n${file.content}\n--- End File ---`,
  );
  return `${message}\n\n${blocks.join("\n\n")}`;
}

export function readExternalFileContent(
  projectRoot: string,
  absolutePath: string,
): { path: string; content: string } | { error: string } {
  const resolved = path.resolve(absolutePath);
  if (!fs.existsSync(resolved)) {
    return { error: "ファイルが見つかりません" };
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) return { error: "ファイルではありません" };
  const content = fs.readFileSync(resolved, "utf-8");
  return {
    path: path.relative(projectRoot, resolved).replace(/\\/g, "/"),
    content,
  };
}

export { resolveFolderPath, resolveFilePath };
