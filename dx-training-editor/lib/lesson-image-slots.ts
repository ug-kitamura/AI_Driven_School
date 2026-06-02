import { getLessonBody } from "@/lib/lesson-frontmatter";
import {
  imageFileName,
  isCanonicalImagePath,
  normalizeImageLogicalPath,
} from "@/lib/image-path";
import { imageFileExists } from "@/lib/image-store";
import type { Lesson } from "@/lib/schema";

const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

export type ImageSlotStatus = "missing" | "staging" | "canonical";

export type LessonImageSlot = {
  canonicalPath: string;
  fileName: string;
  alt: string;
  status: ImageSlotStatus;
  stagingPath: string;
};

function parseSlotsFromBody(body: string): Array<{ alt: string; canonicalPath: string }> {
  const seen = new Set<string>();
  const slots: Array<{ alt: string; canonicalPath: string }> = [];
  for (const match of body.matchAll(MD_IMAGE_RE)) {
    const alt = match[1]?.trim() ?? "";
    const url = match[2]?.trim();
    if (!url || url.startsWith("data:")) continue;
    const normalized = normalizeImageLogicalPath(url);
    if (!isCanonicalImagePath(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    slots.push({ alt, canonicalPath: normalized });
  }
  return slots;
}

export async function listLessonImageSlots(
  projectRoot: string,
  lesson: Pick<Lesson, "content">,
): Promise<LessonImageSlot[]> {
  const body = getLessonBody(lesson);
  const parsed = parseSlotsFromBody(body);
  const result: LessonImageSlot[] = [];

  for (const { alt, canonicalPath } of parsed) {
    const fileName = imageFileName(canonicalPath);
    const stagingPath = `images/ai/${fileName}`;
    const hasCanonical = await imageFileExists(projectRoot, canonicalPath);
    const hasStaging = await imageFileExists(projectRoot, stagingPath);

    let status: ImageSlotStatus = "missing";
    if (hasCanonical) status = "canonical";
    else if (hasStaging) status = "staging";

    result.push({
      canonicalPath,
      fileName,
      alt,
      status,
      stagingPath,
    });
  }

  return result;
}

export function classifySlotKind(alt: string): "ui" | "diagram" | "photo" | "unknown" {
  const m = alt.match(/^\[(ui|diagram|photo)\]/i);
  if (!m) return "unknown";
  return m[1].toLowerCase() as "ui" | "diagram" | "photo";
}
