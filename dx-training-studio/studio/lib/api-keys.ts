export function resolveAiApiKey(req: Request): string | null {
  const header = req.headers.get("x-ai-api-key")?.trim();
  if (header) return header;
  const env = process.env.AI_API_KEY?.trim();
  return env || null;
}

export function resolvePixabayApiKey(req: Request): string | null {
  const header = req.headers.get("x-pixabay-api-key")?.trim();
  if (header) return header;
  const env = process.env.PIXABAY_API_KEY?.trim();
  return env || null;
}

export function isAiApiKeyConfiguredOnServer(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

export function isPixabayApiKeyConfiguredOnServer(): boolean {
  return Boolean(process.env.PIXABAY_API_KEY?.trim());
}
