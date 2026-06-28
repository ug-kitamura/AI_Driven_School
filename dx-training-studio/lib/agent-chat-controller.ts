export type AgentChatController = {
  isStreaming: () => boolean;
  interruptForSwitch: () => Promise<void>;
};
