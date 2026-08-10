import { describe, expect, it, vi, afterEach } from "vitest";
import {
  saveFolderAgentChatStorage,
  createInitialStorage,
  AGENT_CHAT_STORAGE_V2_KEY,
} from "@/lib/agent-chat-storage";

describe("saveFolderAgentChatStorage failure", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    try {
      localStorage.removeItem(AGENT_CHAT_STORAGE_V2_KEY);
    } catch {
      // ignore
    }
  });

  it("returns false when localStorage.setItem throws", () => {
    const storage = createInitialStorage();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => undefined,
    });

    expect(saveFolderAgentChatStorage("demo-folder", storage)).toBe(false);
  });
});
