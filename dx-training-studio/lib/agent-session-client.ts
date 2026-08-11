import {
  createInitialStorage,
  loadFolderAgentChatStorage,
  saveFolderAgentChatStorage,
  type AgentChatStorage,
} from "@/lib/agent-chat-storage";

/**
 * @param scopeKey `serializeWorkScope` が返すスコープ文字列。空文字はシリーズ 0 件
 *   （`contents/` 直下）を表す正当な値であり、エラーではない。
 *   サーバー・localStorage フォールバックの双方で同じキーを使う——スコープはパスなので
 *   フォルダのリネームに追従し、ID の再利用による誤った履歴の引き当ても起きない。
 */
export async function loadScopeSession(
  scopeKey: string,
): Promise<AgentChatStorage> {
  try {
    const res = await fetch(
      `/api/agent/session?scope=${encodeURIComponent(scopeKey)}`,
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

  return loadFolderAgentChatStorage(scopeKey) ?? createInitialStorage();
}

export async function saveScopeSession(
  scopeKey: string,
  storage: AgentChatStorage,
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/agent/session?scope=${encodeURIComponent(scopeKey)}`,
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

  return saveFolderAgentChatStorage(scopeKey, storage);
}
