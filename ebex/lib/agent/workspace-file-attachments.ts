import fs from "node:fs";
import path from "node:path";
import {
  getProjectFolderId,
  SESSION_FILENAME,
  validateRelativeFolderPath,
} from "@/lib/workspace-path-utils";
import { resolveFilePath, resolveFolderPath } from "@/lib/workspace-paths";
import { WORKSPACE_DIR_NAME, ALLOWED_PREFIX } from "@/lib/workspace-constants";

export type WorkspaceFileRef = {
  path: string;
  name: string;
  relativePath: string;
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
  if (parts.length < 2) return false;
  return parts.every((part) => part.length > 0);
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

function listProjectFilesRecursive(
  projectRoot: string,
  projectFolderId: string,
): WorkspaceFileRef[] {
  const validation = validateRelativeFolderPath(projectFolderId);
  if (validation) return [];

  const resolved = resolveFolderPath(projectRoot, projectFolderId);
  if ("error" in resolved) return [];

  const results: WorkspaceFileRef[] = [];

  function walk(absoluteDir: string, relativePrefix: string) {
    if (!fs.existsSync(absoluteDir)) return;
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const entryAbs = path.join(absoluteDir, entry.name);
      const entryRel = relativePrefix
        ? `${relativePrefix}/${entry.name}`
        : entry.name;
      if (entry.isDirectory()) {
        walk(entryAbs, entryRel);
        continue;
      }
      if (!entry.isFile() || entry.name === SESSION_FILENAME) continue;
      results.push({
        name: entry.name,
        relativePath: entryRel,
        path: `${ALLOWED_PREFIX}${projectFolderId}/${entryRel}`,
      });
    }
  }

  walk(resolved.absolutePath, "");
  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath, "ja"));
  return results;
}

export function listWorkspaceFolderFiles(
  projectRoot: string,
  folderId: string,
): WorkspaceFileRef[] {
  const projectFolderId = getProjectFolderId(folderId);
  return listProjectFilesRecursive(projectRoot, projectFolderId);
}

export function orderWorkspaceFilesForPicker(
  files: WorkspaceFileRef[],
  current?: string,
): WorkspaceFileRef[] {
  const sorted = [...files].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, "ja"),
  );
  if (!current) return sorted;

  const idx = sorted.findIndex(
    (file) =>
      file.relativePath === current ||
      file.path === current ||
      file.path.endsWith(`/${current}`),
  );
  if (idx <= 0) return sorted;
  const next = [...sorted];
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
  structuredPaths?: ReadonlyArray<string>,
):
  | { attachments: Array<{ path: string; content: string }> }
  | { error: string } {
  const paths =
    structuredPaths && structuredPaths.length > 0
      ? [...new Set(structuredPaths.map((p) => p.replace(/\\/g, "/")))]
      : extractAttachmentTokens(message);
  const attachments: Array<{ path: string; content: string }> = [];
  for (const relativePath of paths) {
    const result = readAttachmentContents(projectRoot, relativePath);
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
