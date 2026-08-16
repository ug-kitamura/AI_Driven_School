import { getLessonBody, parseLessonDocument } from "@/lib/lesson-frontmatter";
import type { Lesson } from "@/lib/schema";

export type WebImageMediaType = "photo" | "illustration";

export type WebImageSearchQuery = {
  q: string;
  media: WebImageMediaType;
};

export type WebImageSearchPlan = {
  queries: WebImageSearchQuery[];
};

const SYSTEM_PROMPT = `You plan Pixabay stock image searches for a Japanese DX training lesson editor.
Respond with ONLY valid JSON (no markdown fences) in this exact shape:
{"queries":[{"q":"english search words","media":"photo"},{"q":"...","media":"illustration"}]}

Rules:
- Generate 1 to 3 queries total (never more than 3)
- "media" must be "photo" or "illustration"
- Prefer "photo" for realistic everyday business scenes (office, laptop, meeting, teamwork)
- Use "illustration" only when a flat business illustration clearly fits better than a photo
- "q" must be English keywords suitable for Pixabay (2-6 words). No Japanese in q.
- Avoid abstract, fantasy, sci-fi, 3D renders, surreal art — prefer realistic everyday business
- Each query should explore a slightly different angle of the author's brief
`.trim();

export function buildWebSearchPlanMessages(
  lesson: Lesson,
  prompt: string,
): { system: string; user: string } {
  const { meta } = parseLessonDocument(lesson.content);
  const body = getLessonBody(lesson);

  const user = [
    "## Task",
    "Convert the author's image search brief into 1-3 Pixabay search queries.",
    "",
    "## Author search brief",
    prompt,
    "",
    "## Lesson metadata",
    `lesson: ${meta.lesson}`,
    `description: ${meta.description}`,
    `tags: ${(meta.tags ?? []).join(", ")}`,
    "",
    "## Full lesson markdown body",
    body,
    "",
    "Output JSON only.",
  ].join("\n");

  return { system: SYSTEM_PROMPT, user };
}

export function parseWebSearchPlanResponse(raw: string): WebImageSearchPlan {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("invalid search plan JSON");
  }

  if (!parsed || typeof parsed !== "object" || !("queries" in parsed)) {
    throw new Error("invalid search plan shape");
  }

  const queriesRaw = (parsed as { queries: unknown }).queries;
  if (!Array.isArray(queriesRaw) || queriesRaw.length === 0) {
    throw new Error("search plan has no queries");
  }

  const queries: WebImageSearchQuery[] = [];
  for (const item of queriesRaw.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const q = (item as { q?: unknown }).q;
    const media = (item as { media?: unknown }).media;
    if (typeof q !== "string" || !q.trim()) continue;
    if (media !== "photo" && media !== "illustration") continue;
    queries.push({ q: q.trim(), media });
  }

  if (queries.length === 0) {
    throw new Error("search plan has no valid queries");
  }

  return { queries };
}
