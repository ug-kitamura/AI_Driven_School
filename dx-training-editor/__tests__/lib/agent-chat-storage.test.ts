import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_CHAT_STORAGE_KEY,
  addSession,
  createEmptySession,
  createInitialStorage,
  DEFAULT_SESSION_TITLE,
  deleteSession,
  deriveSessionTitle,
  enforceSessionLimit,
  ensureAgentChatStorage,
  exportSessionAsMarkdown,
  formatMessageTimestamp,
  loadAgentChatStorage,
  MAX_AGENT_CHAT_SESSIONS,
  saveAgentChatStorage,
  switchSession,
  updateActiveSession,
} from "@/lib/agent-chat-storage";

describe("agent-chat-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates initial storage when empty", () => {
    const storage = ensureAgentChatStorage();
    expect(storage.sessions).toHaveLength(1);
    expect(storage.activeSessionId).toBe(storage.sessions[0]?.id);
    expect(storage.sessions[0]?.title).toBe(DEFAULT_SESSION_TITLE);
  });

  it("persists and restores sessions", () => {
    const initial = createInitialStorage();
    const withMessage = updateActiveSession(initial, {
      messages: [{ id: "m1", role: "user", content: "hello" }],
      activeSkillId: "create-draft",
      title: deriveSessionTitle("hello"),
    });
    saveAgentChatStorage(withMessage);

    const loaded = loadAgentChatStorage();
    expect(loaded?.sessions[0]?.messages).toEqual([
      { id: "m1", role: "user", content: "hello" },
    ]);
    expect(loaded?.sessions[0]?.activeSkillId).toBe("create-draft");
    expect(loaded?.sessions[0]?.title).toBe("hello");
  });

  it("derives truncated session title", () => {
    const long = "あ".repeat(40);
    expect(deriveSessionTitle(long)).toBe(`${"あ".repeat(30)}…`);
  });

  it("drops oldest sessions when exceeding limit", () => {
    const now = Date.now();
    const sessions = Array.from({ length: MAX_AGENT_CHAT_SESSIONS + 1 }, (_, index) => ({
      ...createEmptySession(new Date(now - index * 1000).toISOString()),
      title: `session-${index}`,
    }));
    const trimmed = enforceSessionLimit(sessions);
    expect(trimmed).toHaveLength(MAX_AGENT_CHAT_SESSIONS);
    expect(trimmed.some((session) => session.title === `session-${MAX_AGENT_CHAT_SESSIONS}`)).toBe(
      false,
    );
  });

  it("adds and switches sessions", () => {
    const initial = createInitialStorage();
    const firstId = initial.activeSessionId;
    const withMessage = updateActiveSession(initial, {
      messages: [{ id: "m1", role: "user", content: "first" }],
    });
    const next = addSession(withMessage);
    expect(next.activeSessionId).not.toBe(firstId);
    expect(next.sessions).toHaveLength(2);

    const switched = switchSession(next, firstId);
    expect(switched.activeSessionId).toBe(firstId);
  });

  it("deletes session and creates fresh one when last session removed", () => {
    const initial = createInitialStorage();
    const next = deleteSession(initial, initial.activeSessionId);
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]?.messages).toEqual([]);
  });

  it("exports markdown", () => {
    const session = {
      ...createEmptySession(),
      title: "Test chat",
      messages: [
        { id: "u1", role: "user" as const, content: "質問" },
        { id: "a1", role: "assistant" as const, content: "回答" },
      ],
    };
    const markdown = exportSessionAsMarkdown(session);
    expect(markdown).toContain("# Test chat");
    expect(markdown).toContain("## User");
    expect(markdown).toContain("質問");
    expect(markdown).toContain("## Assistant");
    expect(markdown).toContain("回答");
  });

  it("returns false when localStorage throws on save", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(saveAgentChatStorage(createInitialStorage())).toBe(false);
    expect(localStorage.getItem(AGENT_CHAT_STORAGE_KEY)).toBeNull();
  });

  it("formats message timestamp from createdAt", () => {
    const message = {
      id: "1",
      role: "user" as const,
      content: "hello",
      createdAt: "2026-06-14T14:30:00.000Z",
    };
    expect(formatMessageTimestamp(message)).toMatch(/14:30/);
  });
});
