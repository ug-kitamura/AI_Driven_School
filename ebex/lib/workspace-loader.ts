import fs from "node:fs";
import path from "node:path";
import {
  SESSION_FILENAME,
  ensureWorkspaceDir,
  getWorkspaceDir,
} from "@/lib/workspace-paths";
import { ensureWorkspaceMeta } from "@/lib/workspace-meta";

export type WorkspaceTreeNode = {
  name: string;
  path: string;
  files: string[];
  children: WorkspaceTreeNode[];
};

/** @deprecated use WorkspaceTreeNode */
export type WorkspaceFolder = WorkspaceTreeNode;

export type WorkspaceLoadResult = {
  folders: WorkspaceTreeNode[];
};

function listUserFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name !== SESSION_FILENAME &&
        !entry.name.startsWith("."),
    )
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

function loadFolderTree(
  absoluteDir: string,
  folderPath: string,
  folderName: string,
): WorkspaceTreeNode {
  const children: WorkspaceTreeNode[] = [];
  if (fs.existsSync(absoluteDir)) {
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const childPath = folderPath ? `${folderPath}/${entry.name}` : entry.name;
      children.push(
        loadFolderTree(
          path.join(absoluteDir, entry.name),
          childPath,
          entry.name,
        ),
      );
    }
  }
  children.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return {
    name: folderName,
    path: folderPath,
    files: listUserFiles(absoluteDir),
    children,
  };
}

export function loadWorkspace(projectRoot: string): WorkspaceLoadResult {
  ensureWorkspaceDir(projectRoot);
  // 旧形式データの一括移行（初回のみ）＋台帳の自己修復同期
  ensureWorkspaceMeta(projectRoot);
  const workspaceDir = getWorkspaceDir(projectRoot);
  const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
  const folders: WorkspaceTreeNode[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    folders.push(
      loadFolderTree(path.join(workspaceDir, entry.name), entry.name, entry.name),
    );
  }

  folders.sort((a, b) => a.path.localeCompare(b.path, "ja"));
  return { folders };
}

function collectWorkspaceMtimes(
  projectRoot: string,
): Array<{ path: string; mtimeMs: number }> {
  ensureWorkspaceDir(projectRoot);
  const workspaceDir = getWorkspaceDir(projectRoot);
  const results: Array<{ path: string; mtimeMs: number }> = [];

  function walk(dir: string, rel: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = path.join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(abs, relPath);
        continue;
      }
      if (entry.name === SESSION_FILENAME) continue;
      const stat = fs.statSync(abs);
      results.push({ path: relPath, mtimeMs: stat.mtimeMs });
    }
  }

  walk(workspaceDir, "");
  return results;
}

/**
 * フォルダ名変更・空フォルダ削除・新規フォルダ作成はファイル mtime を変化させないため、
 * 外部変更検知用 fingerprint にはフォルダ構成（パス一覧）も別途含める。
 */
function collectWorkspaceFolderPaths(projectRoot: string): string[] {
  ensureWorkspaceDir(projectRoot);
  const workspaceDir = getWorkspaceDir(projectRoot);
  const results: string[] = [];

  function walk(dir: string, rel: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      results.push(relPath);
      walk(path.join(dir, entry.name), relPath);
    }
  }

  walk(workspaceDir, "");
  return results;
}

export function getWorkspaceLatestMtime(projectRoot: string): number {
  const mtimes = collectWorkspaceMtimes(projectRoot);
  if (mtimes.length === 0) return 0;
  return Math.max(...mtimes.map((m) => m.mtimeMs));
}

export function getWorkspaceFingerprint(projectRoot: string): string {
  const mtimes = collectWorkspaceMtimes(projectRoot);
  const folderPaths = collectWorkspaceFolderPaths(projectRoot).sort((a, b) =>
    a.localeCompare(b),
  );
  const folderSegment = folderPaths.length > 0 ? folderPaths.join(",") : "";

  if (mtimes.length === 0 && folderPaths.length === 0) return "empty";

  mtimes.sort((a, b) => a.path.localeCompare(b.path));
  const fileSegment = mtimes.map((m) => `${m.path}:${m.mtimeMs}`).join("|");
  return `folders:${folderSegment}|files:${fileSegment}`;
}
