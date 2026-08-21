/**
 * 翻訳 API 共通の LLM 実行。
 *
 * ⚠ モデルは常に `claude-sonnet-5` に固定する（studio-translation spec）。
 * ワークスペースのモデル設定（`x-ai-model` ヘッダー・AI_MODEL env）を見ない——
 * Studio ボタンの翻訳は費用のため Sonnet 5、品質勝負の一括はスキル（Claude Code）
 * という使い分けの決定による。`resolveLlmProvider` を通さないのは意図的。
 */
import { anthropicProvider } from "@/lib/agent/llm/anthropic";
import { TRANSLATION_RETRY_PROMPT } from "@/lib/translation/prompts";

export const TRANSLATION_MODEL = "claude-sonnet-5";

export type TranslationTurnResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status: number };

/**
 * スキーマ検証つきで最大2回（初回＋修正指示のリトライ1回）実行する。
 * ⚠ maxTokens は絞らない——大きい入力で自発 thinking が上限を食い尽くす実測がある
 * （changelog-draft の教訓）。省略してモデルプロファイルの既定に任せる
 */
export async function runTranslationTurn<T>(args: {
  apiKey: string;
  system: string;
  userPrompt: string;
  parse: (text: string) => T | null;
  signal: AbortSignal;
}): Promise<TranslationTurnResult<T>> {
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: args.userPrompt },
  ];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const turn = await anthropicProvider.runTurn({
      apiKey: args.apiKey,
      model: TRANSLATION_MODEL,
      system: args.system,
      messages,
      tools: [],
      signal: args.signal,
    });

    const value = args.parse(turn.text);
    if (value !== null) return { ok: true, value };

    messages.push({ role: "assistant", content: turn.text });
    messages.push({ role: "user", content: TRANSLATION_RETRY_PROMPT });
  }
  // 空応答（上流ストリームの途中切断を含む）もここに落ちる
  return {
    ok: false,
    error: "AI の応答を解釈できませんでした。もう一度試してください",
    status: 502,
  };
}
