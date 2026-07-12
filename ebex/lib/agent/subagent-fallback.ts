/** スキル本文に含まれる場合、EBEX はサブエージェント非対応としてフォールバックする */
export const SUBAGENT_KEYWORD = "サブエージェント";

export const SUBAGENT_FALLBACK_USER_MESSAGE =
  "EBEX はサブエージェントに対応していません。同一セッションで続行します。";

export const SUBAGENT_FALLBACK_MODEL_HINT =
  "EBEX はサブエージェントを起動できない。指示にあっても spawn せず、同じセッション内で自ら役割を順に実行すること。";

export function skillMentionsSubagent(text: string): boolean {
  return text.includes(SUBAGENT_KEYWORD);
}

export function isLikelySubagentToolName(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes("subagent")) return true;
  if (lower === "task") return true;
  if (lower.startsWith("task_")) return true;
  return false;
}
