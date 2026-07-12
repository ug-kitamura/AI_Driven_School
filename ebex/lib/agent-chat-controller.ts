export type AgentSessionChrome = {
  sessionTitle: string;
  isStreaming: boolean;
};

export type AgentChatController = {
  isStreaming: () => boolean;
  interruptForSwitch: () => Promise<void>;
  getSessionChrome: () => AgentSessionChrome | null;
  subscribe: (listener: () => void) => () => void;
};
