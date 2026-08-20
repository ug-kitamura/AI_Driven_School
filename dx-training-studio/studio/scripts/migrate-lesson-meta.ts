/**
 * レッスンの frontmatter を廃止し、レッスンフォルダの `.meta.json` へ移行する一発スクリプト。
 *
 * - `contents.md` 先頭の frontmatter を剥がし、本文のみへ書き換える
 * - frontmatter の値からレッスン `.meta.json` を生成する
 *   （`series` / `course` / `lesson` は捨てる——名前の正本はフォルダ名）
 * - 既存の `id` / `slug` は保持する
 * - frontmatter を持たない `contents.md` は変更しない（冪等）
 *
 * 実行: npx tsx scripts/migrate-lesson-meta.ts
 *（対象は入れ物直下の `../contents/`。実行前に Studio dev サーバーを止めること）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// scripts/ → studio/ → 入れ物直下（getProjectRoot と同じ「studio の親」）
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const CONTENTS_DIR = path.join(PROJECT_ROOT, "contents");
const LESSON_CONTENTS_FILENAME = "contents.md";
const CONTENT_META_FILENAME = ".meta.json";

function isContentFolderName(name: string): boolean {
  return !name.startsWith("_") && !name.startsWith(".");
}

function listContentDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isContentFolderName(e.name))
    .map((e) => e.name);
}

const isDelimiter = (line: string) => /^-{3,}\s*$/.test(line.trim());

/** 旧 frontmatter の line-based パース（このスクリプト内に閉じた最後の実装） */
function splitFrontmatter(
  content: string,
): { meta: Record<string, string | string[]>; body: string } | null {
  const lines = content.split(/\r?\n/);
  if (lines.length < 2 || !isDelimiter(lines[0] ?? "")) return null;
  let closeIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (isDelimiter(lines[i] ?? "")) {
      closeIndex = i;
      break;
    }
  }
  if (closeIndex === -1) return null;

  const meta: Record<string, string | string[]> = {};
  for (const line of lines.slice(1, closeIndex)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("tags:")) {
      const inner = trimmed
        .slice("tags:".length)
        .trim()
        .replace(/^\[/, "")
        .replace(/\]$/, "");
      meta.tags = inner
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      continue;
    }
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    meta[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
  }

  let body = lines.slice(closeIndex + 1).join("\n");
  body = body.replace(/^\r?\n/, "");
  return { meta, body };
}

function migrateStatus(value: unknown): string {
  if (value === "draft") return "open";
  if (value === "open" || value === "in_progress" || value === "done") {
    return value;
  }
  return "open";
}

export function migrateLessonDir(lessonDir: string): boolean {
  const contentsPath = path.join(lessonDir, LESSON_CONTENTS_FILENAME);
  if (!fs.existsSync(contentsPath)) return false;
  const raw = fs.readFileSync(contentsPath, "utf-8");
  const split = splitFrontmatter(raw);
  if (!split) return false;

  const { meta, body } = split;
  const minutes = Number.parseInt(String(meta.estimated_minutes ?? ""), 10);

  const metaPath = path.join(lessonDir, CONTENT_META_FILENAME);
  const existing: Record<string, unknown> = fs.existsSync(metaPath)
    ? (JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
        string,
        unknown
      >)
    : {};

  // series / course / lesson は捨てる（フォルダ名が正本）。
  // frontmatter の値が正本——既存 `.meta.json` はローダーの自己修復（自動採番）で
  // 先に生まれている可能性があり、その id は歴史的な frontmatter の id に劣後する。
  const next: Record<string, unknown> = {
    ...existing,
    ...(typeof meta.id === "string" && meta.id ? { id: meta.id } : {}),
    ...(typeof meta.slug === "string" && meta.slug ? { slug: meta.slug } : {}),
    status: migrateStatus(meta.status),
    description: typeof meta.description === "string" ? meta.description : "",
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    estimated_minutes: Number.isNaN(minutes) ? 0 : minutes,
    author: typeof meta.author === "string" ? meta.author : "",
  };

  fs.writeFileSync(metaPath, JSON.stringify(next, null, 2), "utf-8");
  fs.writeFileSync(contentsPath, body, "utf-8");
  return true;
}

function main() {
  let migrated = 0;
  let skipped = 0;
  for (const series of listContentDirs(CONTENTS_DIR)) {
    const seriesDir = path.join(CONTENTS_DIR, series);
    for (const course of listContentDirs(seriesDir)) {
      const courseDir = path.join(seriesDir, course);
      for (const lesson of listContentDirs(courseDir)) {
        const lessonDir = path.join(courseDir, lesson);
        if (!fs.existsSync(path.join(lessonDir, LESSON_CONTENTS_FILENAME))) {
          continue;
        }
        if (migrateLessonDir(lessonDir)) {
          migrated += 1;
          console.log(`migrated: ${series}/${course}/${lesson}`);
        } else {
          skipped += 1;
          console.log(`skipped (no frontmatter): ${series}/${course}/${lesson}`);
        }
      }
    }
  }
  console.log(`done. migrated=${migrated} skipped=${skipped}`);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main();
}
