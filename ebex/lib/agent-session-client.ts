import {
  createInitialStorage,
  loadFolderAgentChatStorage,
  saveFolderAgentChatStorage,
  type AgentChatStorage,
} from "@/lib/agent-chat-storage";

/**
 * @param folderId サーバー API への問い合わせキー（プロジェクトフォルダ名。サーバー側で ino へ解決される）
 * @param ino localStorage フォールバック専用のキー。プロジェクト名の再利用による
 *   誤った履歴の引き当てを防ぐため、フォルダ名ではなく ino を使う。取得できない場合は
 *   folderId にフォールバックする（no-project 状態など）。
 */
export async function loadFolderSession(
  folderId: string,
  ino?: string,
): Promise<AgentChatStorage> {
  try {
    const res = await fetch(
      `/api/agent/session?folderId=${encodeURIComponent(folderId)}`,
    );
    if (res.ok) {
      const data = (await res.json()) as AgentChatStorage;
      if (data.version === 1 && Array.isArray(data.sessions)) {
        return data;
      }
    }
  } catch {
    /* fall through to localStorage */
  }

  return loadFolderAgentChatStorage(ino ?? folderId) ?? createInitialStorage();
}

export async function saveFolderSession(
  folderId: string,
  storage: AgentChatStorage,
  ino?: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/agent/session?folderId=${encodeURIComponent(folderId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storage),
      },
    );
    if (res.ok) return true;
  } catch {
    /* fall through */
  }

  return saveFolderAgentChatStorage(ino ?? folderId, storage);
}

/** @deprecated use loadFolderSession */
export const loadLessonSession = loadFolderSession;

/** @deprecated use saveFolderSession */
export const saveLessonSession = saveFolderSession;
