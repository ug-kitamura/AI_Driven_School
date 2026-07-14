export type ToolConfirmDecision = "approve" | "reject";

/** 確認待ちのタイムアウト（無応答時は自動的に「拒否」で確定する）。 */
export const TOOL_CONFIRM_TTL_MS = 5 * 60 * 1000;

type PendingEntry = {
  resolve: (decision: ToolConfirmDecision) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingEntry>();

/**
 * ツール呼び出しの確認待ちを登録し、決定（同意/拒否）が届くまで待機する Promise を返す。
 * TTL 経過時はタイムアウトとして自動的に「拒否」を確定する。
 */
export function awaitToolConfirmDecision(
  toolUseId: string,
  ttlMs: number = TOOL_CONFIRM_TTL_MS,
): Promise<ToolConfirmDecision> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pending.delete(toolUseId);
      resolve("reject");
    }, ttlMs);

    pending.set(toolUseId, { resolve, timeout });
  });
}

/**
 * `POST /api/agent/tool-confirm` から呼ばれ、保留中の確認要求を確定させる。
 * 対象が見つからない（存在しない・タイムアウト済み）場合は `false` を返す。
 */
export function resolveToolConfirmDecision(
  toolUseId: string,
  decision: ToolConfirmDecision,
): boolean {
  const entry = pending.get(toolUseId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  pending.delete(toolUseId);
  entry.resolve(decision);
  return true;
}

export function hasPendingToolConfirm(toolUseId: string): boolean {
  return pending.has(toolUseId);
}
