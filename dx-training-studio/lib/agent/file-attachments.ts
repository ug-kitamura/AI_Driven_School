import fs from "node:fs";
import path from "node:path";
import { CONTENTS_DIR_NAME, getContentsDir } from "@/lib/contents-loader";
import { LESSON_CONTENTS_FILENAME } from "@/lib/lesson-paths";

export const ALLOWED_PREFIX = `${CONTENTS_DIR_NAME}/`;

const ATTACHMENT_TOKEN_RE = /@((?:contents\/)[^\s@]+)/g;

export type ContentFileRef = {
  path: string;
  name: string;
};

export function extractAttachmentTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const match of text.matchAll(ATTACHMENT_TOKEN_RE)) {
    tokens.add(match[1]);
  }
  return [...tokens];
}

export function isAllowedContentMdPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!normalized.startsWith(ALLOWED_PREFIX)) return false;
  if (!normalized.endsWith(`/${LESSON_CONTENTS_FILENAME}`)) return false;
  if (normalized.includes("..")) return false;
  return true;
}

export function resolveAllowedContentPath(
  projectRoot: string,
  relativePath: string,
): { absolutePath: string; relativePath: string } | { error: string } {
  const normalized = relativePath.replace(/\\/g, "/");
  if (!isAllowedContentMdPath(normalized)) {
    return { error: `許可されていないパスです: ${relativePath}` };
  }

  const absolutePath = path.resolve(projectRoot, normalized);
  const contentsDir = path.resolve(getContentsDir(projectRoot));
  if (!absolutePath.startsWith(contentsDir + path.sep) && absolutePath !== contentsDir) {
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

export function readAttachmentContents(
  projectRoot: string,
  relativePath: string,
): { path: string; content: string } | { error: string } {
  const resolved = resolveAllowedContentPath(projectRoot, relativePath);
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

export function listContentMarkdownFiles(projectRoot: string): ContentFileRef[] {
  const contentsDir = getContentsDir(projectRoot);
  if (!fs.existsSync(contentsDir)) return [];

  const results: ContentFileRef[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile() || entry.name !== LESSON_CONTENTS_FILENAME) continue;
      const relativePath = path.relative(projectRoot, absolute).replace(/\\/g, "/");
      if (!isAllowedContentMdPath(relativePath)) continue;
      const lessonName = path.basename(path.dirname(relativePath));
      results.push({ path: relativePath, name: lessonName });
    }
  }

  walk(contentsDir);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

/** 選択中レッスンを先頭、残りは path のアルファベット順 */
export function orderContentFilesForPicker(
  files: ContentFileRef[],
  currentPath?: string | null,
): ContentFileRef[] {
  const normalizedCurrent = currentPath?.replace(/\\/g, "/");
  if (!normalizedCurrent) return files;
  const current = files.find((file) => file.path === normalizedCurrent);
  if (!current) return files;
  return [current, ...files.filter((file) => file.path !== normalizedCurrent)];
}
