export function resolveAiApiKey(req: Request): string | null {
  const env = process.env.AI_API_KEY?.trim();
  if (env) return env;
  const header = req.headers.get("x-ai-api-key")?.trim();
  return header || null;
}

export function resolvePixabayApiKey(req: Request): string | null {
  const env = process.env.PIXABAY_API_KEY?.trim();
  if (env) return env;
  const header = req.headers.get("x-pixabay-api-key")?.trim();
  return header || null;
}

export function isAiApiKeyConfiguredOnServer(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

export function isPixabayApiKeyConfiguredOnServer(): boolean {
  return Boolean(process.env.PIXABAY_API_KEY?.trim());
}
