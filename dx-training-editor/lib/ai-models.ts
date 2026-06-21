import { resolveModelLabel } from "@/lib/agent/model-labels";

export type AiModelSlug = "claude-sonnet-4-6" | "gpt-5-nano";

export const DEFAULT_AI_MODEL: AiModelSlug = "claude-sonnet-4-6";

export const UNSUPPORTED_AI_MODELS = new Set<AiModelSlug>(["gpt-5-nano"]);

export const UNSUPPORTED_MODEL_ERROR = "このモデルは未対応です";

export const AI_MODEL_OPTIONS: ReadonlyArray<{
  slug: AiModelSlug;
  label: string;
}> = [
  { slug: "claude-sonnet-4-6", label: resolveModelLabel("claude-sonnet-4-6") },
  { slug: "gpt-5-nano", label: resolveModelLabel("gpt-5-nano") },
];

export function isAiModelSlug(value: unknown): value is AiModelSlug {
  return value === "claude-sonnet-4-6" || value === "gpt-5-nano";
}

export function normalizeAiModel(value: unknown): AiModelSlug {
  return isAiModelSlug(value) ? value : DEFAULT_AI_MODEL;
}

export function isUnsupportedAiModel(model: string): boolean {
  return UNSUPPORTED_AI_MODELS.has(model as AiModelSlug);
}
