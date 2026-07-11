import fs from "node:fs";
import path from "node:path";
import { SESSION_FILENAME, getWorkspaceDir } from "@/lib/workspace-paths";

export const CONTENT_SEARCH_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yml",
  ".yaml",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".html",
  ".htm",
  ".css",
  ".xml",
]);

export const CONTENT_SEARCH_EXCLUDED_DIRS = new Set(["node_modules", ".next"]);

export const CONTENT_SEARCH_MAX_RESULTS = 200;

export type ContentSearchMatch = {
  folderPath: string;
  fileName: string;
};

export type ContentSearchResult = {
  matches: ContentSearchMatch[];
  truncated: boolean;
};

function shouldSkipDir(name: string): boolean {
  return name.startsWith(".") || CONTENT_SEARCH_EXCLUDED_DIRS.has(name);
}

function hasSearchableExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  for (const ext of CONTENT_SEARCH_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function toRelativeFolderPath(
  workspaceDir: string,
  absoluteDir: string,
): string {
  const rel = path.relative(workspaceDir, absoluteDir);
  if (!rel || rel === ".") return "";
  return rel.split(path.sep).join("/");
}

export function searchWorkspaceContent(
  projectRoot: string,
  query: string,
  maxResults = CONTENT_SEARCH_MAX_RESULTS,
): ContentSearchResult {
  const normalized = query.trim();
  if (!normalized) {
    return { matches: [], truncated: false };
  }

  const workspaceDir = getWorkspaceDir(projectRoot);
  if (!fs.existsSync(workspaceDir)) {
    return { matches: [], truncated: false };
  }

  const needle = normalized.toLowerCase();
  const matches: ContentSearchMatch[] = [];
  let truncated = false;

  function walk(currentAbs: string) {
    if (truncated) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentAbs, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (truncated) return;
      const entryAbs = path.join(currentAbs, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        walk(entryAbs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name === SESSION_FILENAME || entry.name.startsWith(".")) {
        continue;
      }
      if (!hasSearchableExtension(entry.name)) continue;

      let content: string;
      try {
        content = fs.readFileSync(entryAbs, "utf-8");
      } catch {
        continue;
      }
      if (!content.toLowerCase().includes(needle)) continue;

      const folderPath = toRelativeFolderPath(workspaceDir, currentAbs);
      matches.push({ folderPath, fileName: entry.name });
      if (matches.length >= maxResults) {
        truncated = true;
        return;
      }
    }
  }

  walk(workspaceDir);
  return { matches, truncated };
}
