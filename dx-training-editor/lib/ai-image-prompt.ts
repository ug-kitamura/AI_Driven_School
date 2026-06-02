import { getLessonBody, parseLessonDocument } from "@/lib/lesson-frontmatter";
import type { Lesson } from "@/lib/schema";
import type { LessonImageSlot } from "@/lib/lesson-image-slots";
import { classifySlotKind } from "@/lib/lesson-image-slots";

const SYSTEM_PROMPT = `You are an expert at creating training diagram HTML fragments for Japanese DX courses.
Output ONLY raw HTML for the inner content that will be placed inside <div id="capture-root">.
Use Tailwind CSS utility classes only (no <style>, no <script>, no external images).
Use simple div-based UI mocks for editors, terminals, browsers, and chat when relevant.
Do not use emoji. Prefer Japanese labels where text is shown.
The fragment must fit within roughly 768px width.`;

export function buildImageGenerationMessages(
  lesson: Lesson,
  slot: LessonImageSlot,
): { system: string; user: string } {
  const { meta } = parseLessonDocument(lesson.content);
  const body = getLessonBody(lesson);
  const kind = classifySlotKind(slot.alt);

  const user = [
    "## Lesson meta",
    `lesson: ${meta.lesson}`,
    `description: ${meta.description}`,
    `tags: ${(meta.tags ?? []).join(", ")}`,
    "",
    "## Full lesson body (markdown)",
    body,
    "",
    "## Target image slot",
    `path: ${slot.canonicalPath}`,
    `alt hint (may be outdated): ${slot.alt}`,
    `kind hint: ${kind}`,
    "",
    "Generate HTML that fits the CURRENT lesson narrative around this slot.",
    "If the alt hint conflicts with the body, prefer the body.",
    kind === "photo"
      ? "This slot is photo type; respond with the single word UNSUPPORTED_PHOTO."
      : "Output only the HTML fragment for #capture-root.",
  ].join("\n");

  return { system: SYSTEM_PROMPT, user };
}

export function isUnsupportedPhotoResponse(text: string): boolean {
  return text.trim() === "UNSUPPORTED_PHOTO";
}
