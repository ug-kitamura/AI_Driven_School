import fs from "node:fs";
import path from "node:path";
import {
  getFileExtension,
  resolveFileIconCategory,
} from "@/lib/workspace-file-icon";
import { resolveFolderPath, SESSION_FILENAME } from "@/lib/workspace-paths";

export const FOLDER_NAME_MAX_EXCERPT_FILES = 10;
export const FOLDER_NAME_MAX_EXCERPT_CHARS = 10_000;
export const FOLDER_NAME_MAX_EXCERPT_LINES = 100;

export const FOLDER_NAME_EXCERPT_EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
]);

export type FolderTextExcerpt = {
  relativePath: string;
  content: string;
};

type TextCandidate = {
  relativePath: string;
  absolutePath: string;
  depth: number;
  tier: number;
};

function shouldSkipDir(name: string): boolean {
  return name.startsWith(".") || FOLDER_NAME_EXCERPT_EXCLUDED_DIRS.has(name);
}

function isExcludedFileName(fileName: string): boolean {
  if (fileName === SESSION_FILENAME) return true;
  if (fileName.startsWith(".")) return true;
  return resolveFileIconCategory(fileName) === "secret";
}

/** basename（拡張子除く）が readme → 0、その他 .md → 1、その他 .txt → 2 */
export function excerptTierForFileName(fileName: string): number {
  const ext = getFileExtension(fileName);
  const base = (
    ext ? fileName.slice(0, fileName.length - ext.length) : fileName
  ).toLowerCase();
  if (base === "readme") return 0;
  if (ext === ".md") return 1;
  if (ext === ".txt") return 2;
  return 99;
}

export function excerptDepthForRelativePath(relativePath: string): number {
  const segments = relativePath.split("/").filter(Boolean);
  return Math.max(0, segments.length - 1);
}

function compareTextCandidates(a: TextCandidate, b: TextCandidate): number {
  if (a.depth !== b.depth) return a.depth - b.depth;
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.relativePath.localeCompare(b.relativePath, "ja");
}

function takeHeadLines(content: string, maxLines: number): string {
  const lines = content.split(/\r?\n/);
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join("\n");
}

function collectTextCandidates(absoluteDir: string): TextCandidate[] {
  const results: TextCandidate[] = [];

  function walk(currentAbs: string, currentRel: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        const nextRel = currentRel
          ? `${currentRel}/${entry.name}`
          : entry.name;
        walk(path.join(currentAbs, entry.name), nextRel);
        continue;
      }

      if (!entry.isFile()) continue;
      if (isExcludedFileName(entry.name)) continue;
      if (resolveFileIconCategory(entry.name) !== "text") continue;

      const relativePath = currentRel
        ? `${currentRel}/${entry.name}`
        : entry.name;
      results.push({
        relativePath,
        absolutePath: path.join(currentAbs, entry.name),
        depth: excerptDepthForRelativePath(relativePath),
        tier: excerptTierForFileName(entry.name),
      });
    }
  }

  walk(absoluteDir, "");
  return results;
}

/** AI フォルダ命名用のテキスト本文抜粋（浅い階層・readme 優先） */
export function listFolderTextExcerptsForNaming(
  projectRoot: string,
  folderPath: string,
  options?: {
    maxFiles?: number;
    maxChars?: number;
    maxLines?: number;
  },
): FolderTextExcerpt[] {
  const resolved = resolveFolderPath(projectRoot, folderPath);
  if ("error" in resolved) return [];

  const maxFiles = options?.maxFiles ?? FOLDER_NAME_MAX_EXCERPT_FILES;
  const maxChars = options?.maxChars ?? FOLDER_NAME_MAX_EXCERPT_CHARS;
  const maxLines = options?.maxLines ?? FOLDER_NAME_MAX_EXCERPT_LINES;

  const candidates = collectTextCandidates(resolved.absolutePath).sort(
    compareTextCandidates,
  );

  const selected: FolderTextExcerpt[] = [];
  let usedChars = 0;

  for (const candidate of candidates) {
    if (selected.length >= maxFiles) break;
    const remaining = maxChars - usedChars;
    if (remaining <= 0) break;

    let raw: string;
    try {
      raw = fs.readFileSync(candidate.absolutePath, "utf-8");
    } catch {
      continue;
    }

    let excerpt = takeHeadLines(raw, maxLines);
    if (excerpt.length > remaining) {
      excerpt = excerpt.slice(0, remaining);
    }
    if (!excerpt.trim()) continue;

    selected.push({
      relativePath: candidate.relativePath,
      content: excerpt,
    });
    usedChars += excerpt.length;
  }

  return selected;
}
