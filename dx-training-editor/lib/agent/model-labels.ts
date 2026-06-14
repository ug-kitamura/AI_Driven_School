const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-opus-4-6": "Claude Opus 4.6",
  "claude-haiku-4-5": "Claude Haiku 4.5",
};

export function resolveModelLabel(model: string): string {
  const trimmed = model.trim();
  return MODEL_LABELS[trimmed] ?? trimmed;
}
