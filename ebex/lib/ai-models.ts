import { resolveModelLabel } from "@/lib/agent/model-labels";

export const AI_MODEL_SLUGS = [
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-opus-4-7",
  "claude-opus-4-8",
  "claude-fable-5",
  "claude-haiku-4-5",
  "gpt-5-nano",
] as const;

export type AiModelSlug = (typeof AI_MODEL_SLUGS)[number];

export const DEFAULT_AI_MODEL: AiModelSlug = "claude-sonnet-4-6";

export const UNSUPPORTED_AI_MODELS = new Set<AiModelSlug>(["gpt-5-nano"]);

export const UNSUPPORTED_MODEL_ERROR = "このモデルは未対応です";

export const AI_MODEL_OPTIONS: ReadonlyArray<{
  slug: AiModelSlug;
  label: string;
}> = AI_MODEL_SLUGS.map((slug) => ({
  slug,
  label: resolveModelLabel(slug),
}));

export function isAiModelSlug(value: unknown): value is AiModelSlug {
  return (
    typeof value === "string" &&
    (AI_MODEL_SLUGS as readonly string[]).includes(value)
  );
}

export function normalizeAiModel(value: unknown): AiModelSlug {
  return isAiModelSlug(value) ? value : DEFAULT_AI_MODEL;
}

export function isUnsupportedAiModel(model: string): boolean {
  return UNSUPPORTED_AI_MODELS.has(model as AiModelSlug);
}

export const MAX_OUTPUT_TOKEN_OPTIONS = [8192, 16384, 32000] as const;
export type MaxOutputTokens = (typeof MAX_OUTPUT_TOKEN_OPTIONS)[number];
export const DEFAULT_MAX_OUTPUT_TOKENS: MaxOutputTokens = 32000;

/** モデル別の最大出力トークン上限。未掲載のモデルは既定値を上限とする。 */
const MODEL_MAX_OUTPUT_TOKENS: Partial<Record<AiModelSlug, number>> = {
  "claude-sonnet-4-6": 32000,
  "claude-sonnet-5": 32000,
  "claude-opus-4-7": 32000,
  "claude-opus-4-8": 32000,
  "claude-fable-5": 16384,
  "claude-haiku-4-5": 16384,
};

export function isMaxOutputTokens(value: unknown): value is MaxOutputTokens {
  return (
    typeof value === "number" &&
    (MAX_OUTPUT_TOKEN_OPTIONS as readonly number[]).includes(value)
  );
}

export function normalizeMaxOutputTokens(value: unknown): MaxOutputTokens {
  return isMaxOutputTokens(value) ? value : DEFAULT_MAX_OUTPUT_TOKENS;
}

/** モデルの上限を超える場合はクランプする。 */
export function clampMaxOutputTokensForModel(
  requested: number,
  model: string,
): number {
  const limit = MODEL_MAX_OUTPUT_TOKENS[model as AiModelSlug] ?? DEFAULT_MAX_OUTPUT_TOKENS;
  return Math.min(requested, limit);
}
