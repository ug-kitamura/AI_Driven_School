/**
 * Agent ストリームの所有セッション判定（純関数）。
 * AgentChatPane は単一インスタンスでストリーミング状態を全フォルダ共有するため、
 * 中断・入力復元は「そのストリームを開始した所有 scopeId」に限定する。
 */

/**
 * 進行中ストリームの所有者が、表示中の scopeId と異なるか。
 * 所有者が判明していて（非 null）、かつ表示中フォルダと一致しないときに true。
 */
export function isForeignActiveStream(
  streamingScopeId: string | null,
  currentScopeId: string | null | undefined,
): boolean {
  return (
    streamingScopeId !== null && streamingScopeId !== (currentScopeId ?? null)
  );
}

/**
 * 中断ボタンを無効化すべきか。
 * ストリーミング中で、そのストリームが別フォルダに所有されているときに true。
 */
export function isStopDisabledForScope(
  isStreaming: boolean,
  streamingScopeId: string | null,
  currentScopeId: string | null | undefined,
): boolean {
  return isStreaming && isForeignActiveStream(streamingScopeId, currentScopeId);
}
