import fs from "node:fs";
import path from "node:path";
import { ALLOWED_PREFIX, WORKSPACE_DIR_NAME } from "@/lib/workspace-constants";
import { isPathInsideProjectFolder } from "@/lib/agent/skill-io-boundary";

export type ResolvedToolPath = {
  /** 実ファイルシステム上の絶対パス */
  absolutePath: string;
  /** `workspace/<folderId>/...` 形式のプロジェクトルート相対パス */
  relativePath: string;
  /** プロジェクトフォルダ（`workspace/<projectFolderId>/`）配下かどうか */
  insideProject: boolean;
};

export type ToolPathError = { error: string };

/**
 * ツール呼び出しが渡すパス文字列を、`workspace/` 配下の実パスへ解決する。
 *
 * 対応する入力形式:
 * - プロジェクト相対（例: `output/minutes.md`) → `workspace/<projectFolderId>/output/minutes.md`
 * - `workspace/...` 形式（例: `workspace/other-lesson/notes.md`) → そのまま解釈
 *
 * `workspace/` を逸脱する絶対パス（Windows ドライブ文字・`/`始まり・`~`）は
 * ツール実行の対象として認めない（EBEX の安全境界は `workspace/` 配下に限定する）。
 */
export function resolveToolTargetPath(
  projectRoot: string,
  projectFolderId: string,
  inputPath: string,
): ResolvedToolPath | ToolPathError {
  const raw = inputPath.replace(/\\/g, "/").trim();
  if (!raw) return { error: "path が空です" };
  if (raw.includes("..")) return { error: `不正なパスです: ${inputPath}` };
  if (/^[a-zA-Z]:\//.test(raw) || raw.startsWith("/") || raw.startsWith("~")) {
    return {
      error: `EBEX の workspace 配下のみ操作できます（プロジェクト外の絶対パスは指定できません）: ${inputPath}`,
    };
  }

  const workspaceDir = path.resolve(projectRoot, WORKSPACE_DIR_NAME);
  const workspaceRelative = raw.startsWith(ALLOWED_PREFIX)
    ? raw.slice(ALLOWED_PREFIX.length)
    : `${projectFolderId}/${raw}`;

  if (!workspaceRelative || workspaceRelative.endsWith("/")) {
    return { error: `不正なパスです: ${inputPath}` };
  }

  const absolutePath = path.resolve(workspaceDir, workspaceRelative);
  if (
    absolutePath !== workspaceDir &&
    !absolutePath.startsWith(workspaceDir + path.sep)
  ) {
    return { error: `不正なパスです: ${inputPath}` };
  }

  const relativePath = `${ALLOWED_PREFIX}${workspaceRelative}`;
  const insideProject = isPathInsideProjectFolder(relativePath, projectFolderId);

  return { absolutePath, relativePath, insideProject };
}

export function pathExists(absolutePath: string): boolean {
  return fs.existsSync(absolutePath);
}

export function isDirectory(absolutePath: string): boolean {
  try {
    return fs.statSync(absolutePath).isDirectory();
  } catch {
    return false;
  }
}
