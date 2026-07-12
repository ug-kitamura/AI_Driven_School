import {
  clampMaxOutputTokensForModel,
  normalizeMaxOutputTokens,
} from "@/lib/ai-models";

/** x-ai-max-output-tokens ヘッダー > 既定値。モデル別上限でクランプする。 */
export function resolveMaxOutputTokens(req: Request, model: string): number {
  const header = req.headers.get("x-ai-max-output-tokens")?.trim();
  const requested = normalizeMaxOutputTokens(header ? Number(header) : undefined);
  return clampMaxOutputTokensForModel(requested, model);
}
