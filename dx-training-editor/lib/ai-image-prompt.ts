import { getLessonBody, parseLessonDocument } from "@/lib/lesson-frontmatter";
import type { Lesson } from "@/lib/schema";
import { sanitizeImageSlug } from "@/lib/image-slug";

export type AiImageGenerationResult = {
  slug: string;
  alt: string;
  html: string;
};

const GRAPHIC_VOCABULARY = `
## Visual vocabulary (creating-visual-explainers graphics only)

- Show familiar UIs with Tailwind mocks (terminal, editor, browser, chat, app screens) — do not describe them in prose outside the diagram.
- Combine structural diagrams AND experience-reproduction mocks when both help.
- Structural patterns: analogy, step flow, left-right compare, card grid, number cards, nested blocks, misconception vs truth, timeline.
- Experience mocks: chat UI, editor UI (traffic lights + sidebar), terminal UI, browser UI, generic app mini-screens.
- Use Lucide via data-lucide attributes only. No emoji. Tailwind utility classes only inside the diagram block.
- Text may appear INSIDE steps, cards, and UI mocks (short labels, 2-3 line hints like model-answer step flow). Optional one-line diagram title (h3).
- **Language:** All visible text inside the diagram (titles, step labels, UI mock strings, button text) MUST be **English** unless the author prompt explicitly requests another language (e.g. "日本語で", "labels in Japanese").
- Do NOT output intro paragraphs, summaries, or captions OUTSIDE the single diagram wrapper card.
`.trim();

const FEW_SHOT_FLOW = `
Example quality (single diagram block inside html field — structure and density reference):

<div class="bg-custom-surface border border-custom-border rounded-xl p-6">
  <h3 class="text-lg font-bold text-slate-900 text-center mb-6">API Request to Response Flow</h3>
  <div class="flex flex-row items-stretch justify-center gap-0">
    <div class="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
      <div class="w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3">1</div>
      <i data-lucide="send" class="w-6 h-6 text-blue-600 mx-auto mb-2"></i>
      <div class="font-bold text-blue-700 text-sm mb-1">Send Request</div>
      <div class="text-xs text-custom-muted leading-relaxed">App sends a request<br>to the API</div>
    </div>
    <div class="flex items-center justify-center w-10"><i data-lucide="chevron-right" class="w-5 h-5 text-custom-dim"></i></div>
    <div class="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
      <div class="w-8 h-8 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3">2</div>
      <i data-lucide="reply" class="w-6 h-6 text-emerald-600 mx-auto mb-2"></i>
      <div class="font-bold text-emerald-700 text-sm mb-1">Receive Response</div>
      <div class="text-xs text-custom-muted leading-relaxed">Result arrives<br>back in the app</div>
    </div>
  </div>
</div>
`.trim();

const SYSTEM_PROMPT = `You create training diagram HTML for Japanese DX courses.
Respond with ONLY valid JSON (no markdown fences) in this exact shape:
{"slug":"english-kebab-case","alt":"短い日本語説明（1行）","html":"<div>...</div>"}

Rules for html:
- ONE diagram block only (e.g. bg-custom-surface rounded-xl card). No page hero, no outer prose.
- Use custom.* Tailwind colors: custom-surface, custom-border, custom-muted, custom-dim, custom-accent, etc.
- Lucide icons: <i data-lucide="name" class="..."></i>
- No <script>, no <style>, no external images, no emoji.
- Width ~768px. Light background.
- Diagram text language: English by default for all labels/titles/UI copy inside html. Use another language only when the author prompt explicitly asks for it.

Rules for alt (markdown accessibility, not rendered in the PNG):
- Keep alt in concise Japanese (1 line) matching the lesson audience.

${GRAPHIC_VOCABULARY}

${FEW_SHOT_FLOW}`;

export function buildImageGenerationMessages(
  lesson: Lesson,
  prompt: string,
): { system: string; user: string } {
  const { meta } = parseLessonDocument(lesson.content);
  const body = getLessonBody(lesson);

  const user = [
    "## Author prompt (primary instruction)",
    prompt.trim(),
    "",
    "## Lesson context (reference only — do not duplicate as outer prose in html)",
    `lesson: ${meta.lesson}`,
    `description: ${meta.description}`,
    `tags: ${(meta.tags ?? []).join(", ")}`,
    "",
    "## Full lesson markdown body",
    body,
    "",
    "Generate JSON with slug, alt, and html for the author prompt.",
  ].join("\n");

  return { system: SYSTEM_PROMPT, user };
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m ? m[1].trim() : trimmed;
}

function fallbackSlugFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split(/\r?\n/)[0] ?? "diagram";
  return sanitizeImageSlug(firstLine.slice(0, 32));
}

function fallbackAltFromPrompt(prompt: string): string {
  const line = prompt.trim().split(/\r?\n/).find((l) => l.trim().length > 0) ?? "図解";
  return line.trim().slice(0, 80);
}

/** Claude 応答をパース。JSON 失敗時は HTML 抽出 + プロンプトから slug/alt を推定 */
export function parseAiGenerationResponse(
  raw: string,
  prompt: string,
): AiImageGenerationResult {
  const cleaned = stripCodeFences(raw);

  try {
    const parsed = JSON.parse(cleaned) as {
      slug?: string;
      alt?: string;
      html?: string;
    };
    const html = parsed.html?.trim();
    if (html) {
      return {
        slug: sanitizeImageSlug(parsed.slug ?? fallbackSlugFromPrompt(prompt)),
        alt: (parsed.alt ?? fallbackAltFromPrompt(prompt)).trim().slice(0, 120),
        html,
      };
    }
  } catch {
    // fall through
  }

  const htmlOnly = cleaned.match(/^[\s\S]*(<div[\s\S]*<\/div>)[\s\S]*$/i)?.[1]?.trim();
  if (htmlOnly) {
    return {
      slug: fallbackSlugFromPrompt(prompt),
      alt: fallbackAltFromPrompt(prompt),
      html: htmlOnly,
    };
  }

  if (cleaned.includes("<div")) {
    return {
      slug: fallbackSlugFromPrompt(prompt),
      alt: fallbackAltFromPrompt(prompt),
      html: cleaned,
    };
  }

  throw new Error("Claude 応答から HTML を取得できませんでした");
}
