import type { WorkspaceSettings } from "@/lib/workspace-settings";

export const AI_KEY_ERROR =
  "AI API キーが設定されていません。設定からキーを入力してください。";

export function aiRequestHeaders(
  settings: WorkspaceSettings,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  headers["x-ai-model"] = settings.aiModel;
  if (settings.aiApiKey) headers["x-ai-api-key"] = settings.aiApiKey;
  if (settings.searchApiKey)
    headers["x-search-api-key"] = settings.searchApiKey;
  return headers;
}
