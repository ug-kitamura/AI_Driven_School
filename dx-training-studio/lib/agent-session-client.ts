import {
  createInitialStorage,
  loadLessonAgentChatStorage,
  saveLessonAgentChatStorage,
  type AgentChatStorage,
} from "@/lib/agent-chat-storage";

export async function loadLessonSession(lessonId: string): Promise<AgentChatStorage> {
  try {
    const res = await fetch(
      `/api/agent/session?lessonId=${encodeURIComponent(lessonId)}`,
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

  return loadLessonAgentChatStorage(lessonId) ?? createInitialStorage();
}

export async function saveLessonSession(
  lessonId: string,
  storage: AgentChatStorage,
): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/agent/session?lessonId=${encodeURIComponent(lessonId)}`,
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

  return saveLessonAgentChatStorage(lessonId, storage);
}
