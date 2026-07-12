export type AgentSessionChrome = {
  sessionTitle: string;
  isStreaming: boolean;
  /** Agent 実行対象のプロジェクトフォルダ ID（未選択時は null） */
  projectFolderId: string | null;
};

export type AgentChatController = {
  isStreaming: () => boolean;
  interruptForSwitch: () => Promise<void>;
  getSessionChrome: () => AgentSessionChrome | null;
  subscribe: (listener: () => void) => () => void;
};
