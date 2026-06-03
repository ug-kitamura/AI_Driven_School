import { getLessonBody, parseLessonDocument } from "@/lib/lesson-frontmatter";
import type { Lesson } from "@/lib/schema";

const SYSTEM_PROMPT = `You write image diagram instructions for a Japanese DX training lesson editor.
The author uses your output as the prompt for AI diagram generation (same style as HTML comment instructions).
Respond with ONLY the prompt text — no markdown fences, no JSON, no preamble or explanation.

Prompt style:
- Describe diagram type (step flow, comparison, UI mock, timeline, etc.) and key visual elements
- Use creating-visual-explainers vocabulary (structure diagrams + terminal/editor/browser mocks when helpful)
- Short labels inside the diagram are OK to mention; do not write full lesson prose
- Japanese is fine unless the lesson context clearly needs another language for UI labels
`.trim();

export function snippetAroundOffset(
  content: string,
  offset: number,
  radius = 500,
): string {
  const safe = Math.max(0, Math.min(offset, content.length));
  const start = Math.max(0, safe - radius);
  const end = Math.min(content.length, safe + radius);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = `…${snippet}`;
  if (end < content.length) snippet = `${snippet}…`;
  return snippet;
}

export function buildSuggestPromptMessages(
  lesson: Lesson,
  cursorOffset: number,
): { system: string; user: string } {
  const { meta } = parseLessonDocument(lesson.content);
  const body = getLessonBody(lesson);
  const cursorContext = snippetAroundOffset(lesson.content, cursorOffset);

  const user = [
    "## Task",
    "Write an image generation prompt suitable for inserting at the author's cursor position in this lesson.",
    "",
    "## Lesson metadata",
    `lesson: ${meta.lesson}`,
    `description: ${meta.description}`,
    `tags: ${(meta.tags ?? []).join(", ")}`,
    "",
    "## Text around cursor (insertion point)",
    cursorContext,
    "",
    "## Full lesson markdown body",
    body,
    "",
    "Output the prompt text only.",
  ].join("\n");

  return { system: SYSTEM_PROMPT, user };
}

export function parseSuggestPromptResponse(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:\w+)?\s*([\s\S]*?)```$/);
  if (fenced) return fenced[1].trim();
  return trimmed;
}
