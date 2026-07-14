import fs from "node:fs";
import path from "node:path";
import { getWorkspaceDir } from "@/lib/workspace-paths";

export const AGENT_PROJECT_FOLDER_MISSING_ERROR =
  "プロジェクトフォルダが見つかりません（リネームまたは削除された可能性があります）。実行を停止しました。";

export function resolveProjectFolderAbsolutePath(
  projectRoot: string,
  projectFolderId: string,
): string {
  return path.join(getWorkspaceDir(projectRoot), projectFolderId);
}

/** ディレクトリが存在しなければエラーメッセージ、存在すれば null */
export function checkProjectFolderExists(
  projectRoot: string,
  projectFolderId: string,
): string | null {
  const id = projectFolderId.trim();
  if (!id) return null;
  const absolutePath = resolveProjectFolderAbsolutePath(projectRoot, id);
  try {
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
      return `${AGENT_PROJECT_FOLDER_MISSING_ERROR} (workspace/${id})`;
    }
  } catch {
    return `${AGENT_PROJECT_FOLDER_MISSING_ERROR} (workspace/${id})`;
  }
  return null;
}
