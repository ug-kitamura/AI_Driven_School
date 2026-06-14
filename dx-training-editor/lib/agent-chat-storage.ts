export type AgentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type AgentChatSession = {
  id: string;
  title: string;
  messages: AgentChatMessage[];
  activeSkillId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentChatStorage = {
  version: 1;
  activeSessionId: string;
  sessions: AgentChatSession[];
};

export const AGENT_CHAT_STORAGE_KEY = "dx-training-editor-agent-chat";
export const MAX_AGENT_CHAT_SESSIONS = 20;
export const DEFAULT_SESSION_TITLE = "新しい会話";

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function deriveSessionTitle(content: string, maxLength = 30): string {
  const trimmed = content.trim();
  if (!trimmed) return DEFAULT_SESSION_TITLE;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

export function createEmptySession(now = new Date().toISOString()): AgentChatSession {
  return {
    id: createSessionId(),
    title: DEFAULT_SESSION_TITLE,
    messages: [],
    activeSkillId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createInitialStorage(): AgentChatStorage {
  const session = createEmptySession();
  return {
    version: 1,
    activeSessionId: session.id,
    sessions: [session],
  };
}

function sortSessionsByUpdatedAt(sessions: AgentChatSession[]): AgentChatSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function enforceSessionLimit(sessions: AgentChatSession[]): AgentChatSession[] {
  if (sessions.length <= MAX_AGENT_CHAT_SESSIONS) return sessions;
  const sorted = sortSessionsByUpdatedAt(sessions);
  return sorted.slice(0, MAX_AGENT_CHAT_SESSIONS);
}

export function loadAgentChatStorage(): AgentChatStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AGENT_CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgentChatStorage;
    if (parsed.version !== 1 || !parsed.activeSessionId || !Array.isArray(parsed.sessions)) {
      return null;
    }
    const sessions = enforceSessionLimit(parsed.sessions);
    const activeSessionId = sessions.some((s) => s.id === parsed.activeSessionId)
      ? parsed.activeSessionId
      : (sessions[0]?.id ?? parsed.activeSessionId);
    return { version: 1, activeSessionId, sessions };
  } catch {
    return null;
  }
}

export function saveAgentChatStorage(storage: AgentChatStorage): boolean {
  if (typeof window === "undefined") return false;
  try {
    const normalized: AgentChatStorage = {
      version: 1,
      activeSessionId: storage.activeSessionId,
      sessions: enforceSessionLimit(storage.sessions),
    };
    localStorage.setItem(AGENT_CHAT_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function ensureAgentChatStorage(): AgentChatStorage {
  const loaded = loadAgentChatStorage();
  if (loaded && loaded.sessions.length > 0) return loaded;
  const initial = createInitialStorage();
  saveAgentChatStorage(initial);
  return initial;
}

export function getActiveSession(storage: AgentChatStorage): AgentChatSession | undefined {
  return storage.sessions.find((session) => session.id === storage.activeSessionId);
}

export function updateActiveSession(
  storage: AgentChatStorage,
  updates: Partial<Pick<AgentChatSession, "messages" | "activeSkillId" | "title">>,
): AgentChatStorage {
  const now = new Date().toISOString();
  const sessions = storage.sessions.map((session) => {
    if (session.id !== storage.activeSessionId) return session;
    return {
      ...session,
      ...updates,
      updatedAt: now,
    };
  });
  return { ...storage, sessions: enforceSessionLimit(sessions) };
}

export function addSession(storage: AgentChatStorage): AgentChatStorage {
  const session = createEmptySession();
  return enforceStorage({
    version: 1,
    activeSessionId: session.id,
    sessions: enforceSessionLimit([session, ...storage.sessions]),
  });
}

function enforceStorage(storage: AgentChatStorage): AgentChatStorage {
  const sessions = enforceSessionLimit(storage.sessions);
  const activeSessionId = sessions.some((s) => s.id === storage.activeSessionId)
    ? storage.activeSessionId
    : (sessions[0]?.id ?? storage.activeSessionId);
  return { version: 1, activeSessionId, sessions };
}

export function switchSession(storage: AgentChatStorage, sessionId: string): AgentChatStorage {
  if (!storage.sessions.some((session) => session.id === sessionId)) return storage;
  return { ...storage, activeSessionId: sessionId };
}

export function deleteSession(storage: AgentChatStorage, sessionId: string): AgentChatStorage {
  const remaining = storage.sessions.filter((session) => session.id !== sessionId);
  if (remaining.length === 0) {
    const fresh = createEmptySession();
    return { version: 1, activeSessionId: fresh.id, sessions: [fresh] };
  }
  const activeSessionId =
    storage.activeSessionId === sessionId ? remaining[0].id : storage.activeSessionId;
  return enforceStorage({ version: 1, activeSessionId, sessions: remaining });
}

export function listSessionsSorted(storage: AgentChatStorage): AgentChatSession[] {
  return sortSessionsByUpdatedAt(storage.sessions);
}

export function formatSessionUpdatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatMessageTimestamp(message: AgentChatMessage): string {
  const iso = message.createdAt ?? messageTimestampFromId(message.id);
  if (!iso) return "";
  return formatSessionUpdatedAt(iso);
}

function messageTimestampFromId(id: string): string | null {
  const ms = Number.parseInt(id.split("-")[0] ?? "", 10);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

export function exportSessionAsMarkdown(session: AgentChatSession): string {
  const lines = [`# ${session.title}`, "", `Exported: ${new Date().toISOString()}`, ""];
  for (const message of session.messages) {
    const heading = message.role === "user" ? "## User" : "## Assistant";
    lines.push(heading, "", message.content, "");
  }
  return lines.join("\n");
}

export function downloadSessionMarkdown(session: AgentChatSession): void {
  const markdown = exportSessionAsMarkdown(session);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `agent-chat-${date}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
