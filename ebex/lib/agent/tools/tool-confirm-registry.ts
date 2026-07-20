export type ToolConfirmDecision = "approve" | "reject";

/** 確認待ちの結末。timeout は無応答（拒否と同じく実行しないが、理由表示を分ける） */
export type ToolConfirmOutcome = ToolConfirmDecision | "timeout";

/**
 * 確認待ちの解決値。decision に加え、人手フォールバック（web-search-manual）で
 * ユーザーが貼り付けた検索結果テキストを運ぶ。
 */
export type ToolConfirmResolution = {
  decision: ToolConfirmOutcome;
  /** web-search-manual の承認時にユーザーが貼り付けた検索結果＋ソース URL */
  manualSearchText?: string;
};

/** 確認待ちのタイムアウト（無応答時は自動的に「拒否」で確定する）。 */
export const TOOL_CONFIRM_TTL_MS = 5 * 60 * 1000;

type PendingEntry = {
  resolve: (resolution: ToolConfirmResolution) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const pending = new Map<string, PendingEntry>();

/**
 * ツール呼び出しの確認待ちを登録し、決定（同意/拒否）が届くまで待機する Promise を返す。
 * TTL 経過時は "timeout" で確定する（実行しない点は拒否と同じ）。
 */
export function awaitToolConfirmDecision(
  toolUseId: string,
  ttlMs: number = TOOL_CONFIRM_TTL_MS,
): Promise<ToolConfirmResolution> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pending.delete(toolUseId);
      resolve({ decision: "timeout" });
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
  manualSearchText?: string,
): boolean {
  const entry = pending.get(toolUseId);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  pending.delete(toolUseId);
  entry.resolve({
    decision,
    ...(manualSearchText !== undefined ? { manualSearchText } : {}),
  });
  return true;
}

export function hasPendingToolConfirm(toolUseId: string): boolean {
  return pending.has(toolUseId);
}
