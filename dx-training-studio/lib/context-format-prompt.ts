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
): { body: string; suggestedTags: string[] } | null {
  const cleaned = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(cleaned) as {
      body?: string;
      suggestedTags?: unknown;
    };
    const body = parsed.body?.trim();
    if (!body) return null;

    const suggestedTags = Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    if (suggestedTags.length === 0) return null;
    return { body, suggestedTags };
  } catch {
    return null;
  }
}
