import type { AgentFileAttachment } from "@/lib/agent-chat-storage";

export type AgentSessionChrome = {
  sessionTitle: string;
  isStreaming: boolean;
  /** Agent 実行対象のプロジェクトフォルダ ID（未選択時は null） */
  projectFolderId: string | null;
};

export type AgentChatController = {
  isStreaming: () => boolean;
  getSessionChrome: () => AgentSessionChrome | null;
  subscribe: (listener: () => void) => () => void;
  /** 構造化ファイル添付を入力チップへ追加する（同一 path は重複追加しない） */
  addFileAttachment: (attachment: AgentFileAttachment) => void;
};
