import {
  createInitialStorage,
  loadFolderAgentChatStorage,
  saveFolderAgentChatStorage,
  type AgentChatStorage,
} from "@/lib/agent-chat-storage";

export async function loadFolderSession(
  folderId: string,
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

  return loadFolderAgentChatStorage(folderId) ?? createInitialStorage();
}

export async function saveFolderSession(
  folderId: string,
  storage: AgentChatStorage,
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

  return saveFolderAgentChatStorage(folderId, storage);
}

/** @deprecated use loadFolderSession */
export const loadLessonSession = loadFolderSession;

/** @deprecated use saveFolderSession */
export const saveLessonSession = saveFolderSession;
