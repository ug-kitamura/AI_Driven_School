import { getProjectFolderId } from "@/lib/workspace-path-utils";

/** invoke 中のプロジェクトフォルダ（refcount）。サーバプロセス内メモリ。 */
const activeCounts = new Map<string, number>();

export function markProjectFolderAgentActive(
  projectFolderId: string,
): () => void {
  const id = projectFolderId.trim();
  if (!id) return () => {};

  activeCounts.set(id, (activeCounts.get(id) ?? 0) + 1);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = (activeCounts.get(id) ?? 1) - 1;
    if (next <= 0) activeCounts.delete(id);
    else activeCounts.set(id, next);
  };
}

export function isProjectFolderAgentActive(projectFolderId: string): boolean {
  const id = projectFolderId.trim();
  if (!id) return false;
  return (activeCounts.get(id) ?? 0) > 0;
}

/**
 * 実行中ロック対象か（トップレベルプロジェクトフォルダのみ）。
 * `demo/sub` の rename/delete はロックしない。
 */
export function isAgentLockedProjectFolder(
  folderPath: string,
  busyProjectFolderId: string | null | undefined,
): boolean {
  const busy = busyProjectFolderId?.trim();
  if (!busy) return false;
  const trimmed = folderPath.trim();
  if (!trimmed || trimmed.includes("/")) return false;
  return getProjectFolderId(trimmed) === busy;
}

export const AGENT_BUSY_FOLDER_ERROR =
  "Agent 実行中のため、このフォルダのリネーム／削除はできません。実行が終わるまでお待ちください。";

/** テスト用 */
export function resetActiveProjectFoldersForTests(): void {
  activeCounts.clear();
}
