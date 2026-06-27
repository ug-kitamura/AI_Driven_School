import fs from "node:fs";
import path from "node:path";

const CONTRACT_PATH = path.join(process.cwd(), "contracts", "context-format-contract.md");

export function loadContextFormatContract(): string {
  return fs.readFileSync(CONTRACT_PATH, "utf-8");
}

export function buildContextFormatMessages(
  rawText: string,
  existingTags: string[] = [],
): { system: string; user: string } {
  const contract = loadContextFormatContract();
  const tagSection =
    existingTags.length > 0
      ? `\n\n## 既存タグ（優先して選ぶ）\n${existingTags.map((tag) => `- ${tag}`).join("\n")}`
      : "";

  return {
    system: contract,
    user: [`## 原文`, rawText.trim(), tagSection].filter(Boolean).join("\n\n"),
  };
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return match ? match[1].trim() : trimmed;
}

export function parseContextFormatResponse(
  raw: string,
): {
  title: string;
  body: string;
  suggestedTags: string[];
  source_last_updated_at: string | null;
} | null {
  const cleaned = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(cleaned) as {
      title?: string;
      body?: string;
      suggestedTags?: unknown;
      source_last_updated_at?: unknown;
    };
    const title = parsed.title?.trim();
    const body = parsed.body?.trim();
    if (!title || !body) return null;

    const suggestedTags = Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (suggestedTags.length === 0) return null;

    let sourceLastUpdated: string | null = null;
    if (typeof parsed.source_last_updated_at === "string") {
      const date = parsed.source_last_updated_at.trim().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        sourceLastUpdated = date;
      }
    }

    return { title, body, suggestedTags, source_last_updated_at: sourceLastUpdated };
  } catch {
    return null;
  }
}
