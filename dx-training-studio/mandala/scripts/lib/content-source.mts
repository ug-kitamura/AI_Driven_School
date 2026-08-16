/**
 * 正本（`../contents`）を読み取る専用ローダー。
 *
 * 走査規則の正本は Studio 側の `lib/contents-loader.ts` / `lib/lesson-frontmatter.ts`。
 * site は独立プロジェクトなので直接 import せず、ここで同じ規則を実装する。
 * ずれの検出は `__tests__/content-source.parity.test.ts`（実 contents を両者で読んで突き合わせ）が担う。
 */
import fs from "node:fs";
import path from "node:path";

export type LessonStatus = "open" | "in_progress" | "done";

export type LessonMeta = {
  /** ディレクトリ名（表示名） */
  name: string;
  slug?: string;
  /** frontmatter の安定 ID（`lsn-...`） */
  id?: string;
  status: LessonStatus;
  description: string;
  tags: string[];
  estimatedMinutes: number;
  author: string;
  /** frontmatter を除いた本文 */
  body: string;
  /** 英語版本文（`contents.en.md`）。無ければ undefined */
  bodyEn?: string;
  /** 英語版 frontmatter の title */
  titleEn?: string;
  dir: string;
};

/** コースの受講形態。Studio の `lib/schema.ts` と同じ語彙 */
export const COURSE_STYLES = ["self-study", "lecture", "hands-on"] as const;
export type CourseStyle = (typeof COURSE_STYLES)[number];

/** 語彙内なら採用し、未設定・語彙外はどちらも undefined（Studio ローダーと同じ解釈） */
function courseStyle(value: unknown): CourseStyle | undefined {
  return typeof value === "string" &&
    (COURSE_STYLES as readonly string[]).includes(value)
    ? (value as CourseStyle)
    : undefined;
}

export type CourseMeta = {
  name: string;
  id?: string;
  slug?: string;
  description?: string;
  catch?: string;
  target?: string;
  style?: CourseStyle;
  nameEn?: string;
  descriptionEn?: string;
  catchEn?: string;
  crossSeriesPrev: string[];
  crossSeriesNext: string[];
  /** カリキュラムの入口・到達点の宣言。未宣言ではキーを持たない */
  isStart?: boolean;
  isGoal?: boolean;
  lessons: LessonMeta[];
  dir: string;
};

export type SeriesMeta = {
  name: string;
  id?: string;
  slug?: string;
  description?: string;
  catch?: string;
  cover?: string;
  nameEn?: string;
  descriptionEn?: string;
  catchEn?: string;
  courses: CourseMeta[];
  dir: string;
};

export type ContentsRoot = {
  description?: string;
  descriptionEn?: string;
  series: SeriesMeta[];
};

const LESSON_CONTENTS_FILENAME = "contents.md";
const LESSON_CONTENTS_EN_FILENAME = "contents.en.md";
const META_FILENAME = ".meta.json";

/** `_` / `.` 始まりは構造として解釈しない（Studio の `isContentFolderName` と同じ） */
function isContentFolderName(name: string): boolean {
  return !name.startsWith("_") && !name.startsWith(".");
}

function readMetaJson(dir: string): Record<string, unknown> {
  const metaPath = path.join(dir, META_FILENAME);
  if (!fs.existsSync(metaPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function listContentDirNames(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isContentFolderName(e.name))
    .map((e) => e.name);
}

/** `.meta.json` の order を実体と突き合わせる（order 優先、無い実体は名前順で末尾） */
function effectiveOrder(order: string[], actual: string[]): string[] {
  const actualSet = new Set(actual);
  const ordered = order.filter(
    (name) => isContentFolderName(name) && actualSet.has(name),
  );
  const seen = new Set(ordered);
  const rest = actual.filter((name) => !seen.has(name)).sort();
  return [...ordered, ...rest];
}

/** レッスンフォルダ（`contents.md` を持つディレクトリ）だけを返す */
function listLessonFolderNames(courseDir: string): string[] {
  if (!fs.existsSync(courseDir)) return [];
  return fs
    .readdirSync(courseDir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() &&
        isContentFolderName(e.name) &&
        fs.existsSync(path.join(courseDir, e.name, LESSON_CONTENTS_FILENAME)),
    )
    .map((e) => e.name);
}

export type ParsedFrontmatter = {
  meta: Record<string, string | string[]>;
  body: string;
};

/** 先頭の `---` 区切りフロントマターを分離する（Studio の `splitFrontmatterText` と同じ判定） */
export function parseFrontmatter(content: string): ParsedFrontmatter {
  const lines = content.split(/\r?\n/);
  const isDelimiter = (line: string) => /^-{3,}\s*$/.test(line.trim());
  if (lines.length < 2 || !isDelimiter(lines[0] ?? "")) {
    return { meta: {}, body: content };
  }
  let closeIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (isDelimiter(lines[i] ?? "")) {
      closeIndex = i;
      break;
    }
  }
  if (closeIndex === -1) return { meta: {}, body: content };

  const meta: Record<string, string | string[]> = {};
  for (const line of lines.slice(1, closeIndex)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("tags:")) {
      const value = trimmed.slice("tags:".length).trim();
      const inner = value.replace(/^\[/, "").replace(/\]$/, "");
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

  return { meta, body: lines.slice(closeIndex + 1).join("\n") };
}

function migrateStatus(value: unknown): LessonStatus {
  if (value === "draft") return "open";
  if (value === "open" || value === "in_progress" || value === "done")
    return value;
  return "open";
}

function readLesson(courseDir: string, lessonName: string): LessonMeta {
  const lessonDir = path.join(courseDir, lessonName);
  const raw = fs.readFileSync(
    path.join(lessonDir, LESSON_CONTENTS_FILENAME),
    "utf-8",
  );
  const { meta, body } = parseFrontmatter(raw);

  const minutes = Number.parseInt(String(meta.estimated_minutes ?? ""), 10);

  let bodyEn: string | undefined;
  let titleEn: string | undefined;
  const enPath = path.join(lessonDir, LESSON_CONTENTS_EN_FILENAME);
  if (fs.existsSync(enPath)) {
    const parsedEn = parseFrontmatter(fs.readFileSync(enPath, "utf-8"));
    bodyEn = parsedEn.body;
    titleEn =
      typeof parsedEn.meta.lesson === "string"
        ? parsedEn.meta.lesson
        : undefined;
  }

  return {
    name: lessonName,
    slug: typeof meta.slug === "string" ? meta.slug : undefined,
    id: typeof meta.id === "string" ? meta.id : undefined,
    status: migrateStatus(meta.status),
    description: typeof meta.description === "string" ? meta.description : "",
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    estimatedMinutes: Number.isNaN(minutes) ? 0 : minutes,
    author: typeof meta.author === "string" ? meta.author : "",
    body,
    bodyEn,
    titleEn,
    dir: lessonDir,
  };
}

function readCourse(seriesDir: string, courseName: string): CourseMeta {
  const courseDir = path.join(seriesDir, courseName);
  const meta = readMetaJson(courseDir);
  const lessonNames = effectiveOrder(
    strArray(meta.order),
    listLessonFolderNames(courseDir),
  );

  return {
    name: courseName,
    id: str(meta.id),
    slug: str(meta.slug),
    description: str(meta.description),
    catch: str(meta.catch),
    target: str(meta.target) ?? str(meta.target_audience),
    style: courseStyle(meta.style),
    nameEn: str(meta.name_en),
    descriptionEn: str(meta.description_en),
    catchEn: str(meta.catch_en),
    crossSeriesPrev: strArray(meta.cross_series_prev),
    crossSeriesNext: strArray(meta.cross_series_next),
    ...(meta.is_start === true ? { isStart: true } : {}),
    ...(meta.is_goal === true ? { isGoal: true } : {}),
    lessons: lessonNames.map((name) => readLesson(courseDir, name)),
    dir: courseDir,
  };
}

function readSeries(contentsDir: string, seriesName: string): SeriesMeta {
  const seriesDir = path.join(contentsDir, seriesName);
  const meta = readMetaJson(seriesDir);
  const courseNames = effectiveOrder(
    strArray(meta.order),
    listContentDirNames(seriesDir),
  );

  return {
    name: seriesName,
    id: str(meta.id),
    slug: str(meta.slug),
    description: str(meta.description),
    catch: str(meta.catch),
    cover: str(meta.cover),
    nameEn: str(meta.name_en),
    descriptionEn: str(meta.description_en),
    catchEn: str(meta.catch_en),
    courses: courseNames.map((name) => readCourse(seriesDir, name)),
    dir: seriesDir,
  };
}

/** `contents/` を走査して全階層を読む（読み取り専用。正本は変更しない） */
export function loadContents(contentsDir: string): ContentsRoot {
  if (!fs.existsSync(contentsDir)) {
    return { series: [] };
  }
  const rootMeta = readMetaJson(contentsDir);
  const seriesNames = effectiveOrder(
    strArray(rootMeta.order),
    listContentDirNames(contentsDir),
  );

  return {
    description: str(rootMeta.description),
    descriptionEn: str(rootMeta.description_en),
    series: seriesNames.map((name) => readSeries(contentsDir, name)),
  };
}
