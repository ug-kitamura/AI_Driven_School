export function resolveAnthropicApiKey(req: Request): string | null {
  const header = req.headers.get("x-anthropic-api-key")?.trim();
  if (header) return header;
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  return env || null;
}

export function resolvePixabayApiKey(req: Request): string | null {
  const header = req.headers.get("x-pixabay-api-key")?.trim();
  if (header) return header;
  const env = process.env.PIXABAY_API_KEY?.trim();
  return env || null;
}
