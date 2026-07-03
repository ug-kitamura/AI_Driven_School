import type { AgentChatSession } from "@/lib/agent-chat-storage";

export type AgentSessionChrome = {
  sessionTitle: string;
  historyOpen: boolean;
  sortedSessions: AgentChatSession[];
  activeSessionId: string | undefined;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleNewSession: () => void;
  handleSwitchSession: (sessionId: string) => void;
  requestDeleteSession: (sessionId: string) => void;
};

export type AgentChatController = {
  isStreaming: () => boolean;
  interruptForSwitch: () => Promise<void>;
  getSessionChrome: () => AgentSessionChrome | null;
  subscribe: (listener: () => void) => () => void;
};
