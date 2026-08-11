import type { AgentFileAttachment } from "@/lib/agent-chat-storage";

/** 未送信のチャット入力（本文＋添付チップ）。 */
export type AgentChatDraft = {
  input: string;
  attachments: AgentFileAttachment[];
};

/**
 * プロジェクトフォルダ（`scopeId`）単位の下書き。
 * `AgentChatPane` はフォルダ切替でリマウントされるため、保持先はその外側
 * （`AgentPane`）に置く。メモリ上のみで、リロードはまたがない。
 */
export type AgentChatDraftMap = Map<string, AgentChatDraft>;
