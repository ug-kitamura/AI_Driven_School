import type { Lesson, LessonStatus, Series } from "@/lib/schema";

export type LessonParentContext = {
  seriesName: string;
  courseName: string;
};

export type LessonMetaFields = {
  series: string;
  course: string;
  lesson: string;
  status: LessonStatus;
  description: string;
  tags: string[];
  estimated_minutes: number;
  author: string;
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const TAG_PATTERN = /^[a-z0-9-]+$/;
const VALID_STATUSES: LessonStatus[] = ["open", "in_progress", "done"];

export function migrateLegacyStatus(status: string): LessonStatus {
  if (status === "draft") return "open";
  if (VALID_STATUSES.includes(status as LessonStatus)) {
    return status as LessonStatus;
  }
  return "open";
}

export function parseLessonDocument(content: string | undefined | null): {
  meta: Partial<LessonMetaFields>;
  body: string;
} {
  const text = content ?? "";
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    return { meta: {}, body: text };
  }
  return { meta: parseYamlBlock(match[1]), body: match[2] };
}

function parseYamlBlock(yaml: string): Partial<LessonMetaFields> {
  const meta: Partial<LessonMetaFields> = {};
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("tags:")) {
      const value = trimmed.slice("tags:".length).trim();
      if (value === "[]") {
        meta.tags = [];
      } else {
        const inner = value.replace(/^\[/, "").replace(/\]$/, "");
        meta.tags = inner
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const raw = trimmed.slice(colon + 1).trim();

    switch (key) {
      case "series":
        meta.series = raw;
        break;
      case "course":
        meta.course = raw;
        break;
      case "lesson":
        meta.lesson = raw;
        break;
      case "status":
        meta.status = migrateLegacyStatus(raw);
        break;
      case "description":
        meta.description = raw;
        break;
      case "estimated_minutes": {
        const n = Number.parseInt(raw, 10);
        if (!Number.isNaN(n)) meta.estimated_minutes = n;
        break;
      }
      case "author":
        meta.author = raw;
        break;
      default:
        break;
    }
  }
  return meta;
}

export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  return tags.filter((t) => TAG_PATTERN.test(t));
}

export function normalizeLessonMeta(
  partial: Partial<LessonMetaFields>,
  ctx: LessonParentContext,
  fallbacks?: Partial<LessonMetaFields>,
): LessonMetaFields {
  const status = migrateLegacyStatus(
    partial.status ?? fallbacks?.status ?? "open",
  );
  let minutes =
    partial.estimated_minutes ??
    fallbacks?.estimated_minutes ??
    0;
  if (Number.isNaN(minutes)) minutes = 0;
  minutes = Math.min(180, Math.max(0, Math.round(minutes)));

  return {
    series: ctx.seriesName,
    course: ctx.courseName,
    lesson: (partial.lesson ?? fallbacks?.lesson ?? "").trim() || "無題のレッスン",
    status,
    description: partial.description ?? fallbacks?.description ?? "",
    tags: normalizeTags(partial.tags ?? fallbacks?.tags),
    estimated_minutes: minutes,
    author: partial.author ?? fallbacks?.author ?? "",
  };
}

export function serializeLessonDocument(
  meta: LessonMetaFields,
  body: string,
): string {
  const tagsYaml =
    meta.tags.length === 0
      ? "tags: []"
      : `tags: [${meta.tags.join(", ")}]`;
  const yaml = [
    "---",
    `series: ${meta.series}`,
    `course: ${meta.course}`,
    `lesson: ${meta.lesson}`,
    `status: ${meta.status}`,
    `description: ${meta.description}`,
    tagsYaml,
    `estimated_minutes: ${meta.estimated_minutes}`,
    `author: ${meta.author}`,
    "---",
  ].join("\n");
  const trimmedBody = body.replace(/^\n+/, "");
  return trimmedBody ? `${yaml}\n\n${trimmedBody}` : `${yaml}\n\n`;
}

export function metaToLessonFields(meta: LessonMetaFields): Pick<
  Lesson,
  | "series"
  | "course"
  | "lesson"
  | "status"
  | "description"
  | "tags"
  | "estimated_minutes"
  | "author"
> {
  return {
    series: meta.series,
    course: meta.course,
    lesson: meta.lesson,
    status: meta.status,
    description: meta.description,
    tags: meta.tags,
    estimated_minutes: meta.estimated_minutes,
    author: meta.author,
  };
}

/** :::quiz ブロックを ### 確認問題 + タスクリストへ変換 */
export function migrateQuizBlocksInBody(body: string): string {
  return body.replace(/:::quiz\r?\n([\s\S]*?):::/g, (_, inner: string) => {
    const lines = inner.trim().split(/\r?\n/);
    const qLine = lines.find((l) => /^Q:\s*/.test(l.trim()));
    const question = qLine ? qLine.replace(/^Q:\s*/, "").trim() : "";
    const choices = lines.filter((l) => /^\s*-\s+\[[ x]\]/.test(l));
    const parts = ["### 確認問題", ""];
    if (question) parts.push(question, "");
    if (choices.length) parts.push(...choices, "");
    return `${parts.join("\n")}\n`;
  });
}

export function defaultLessonBody(lessonName: string): string {
  return `# ${lessonName}\n\n（ここに本文を書いてください）\n`;
}

export function createLessonContentTemplate(
  meta: LessonMetaFields,
  body?: string,
): string {
  return serializeLessonDocument(meta, body ?? defaultLessonBody(meta.lesson));
}

export function reconcileLesson(
  lesson: Lesson,
  ctx: LessonParentContext,
): Lesson {
  const { meta: yamlMeta, body: rawBody } = parseLessonDocument(lesson.content);
  let body = rawBody.trim() ? migrateQuizBlocksInBody(rawBody) : "";

  const normalized = normalizeLessonMeta(
    {
      series: yamlMeta.series,
      course: yamlMeta.course,
      lesson: yamlMeta.lesson,
      status: yamlMeta.status,
      description: yamlMeta.description,
      tags: yamlMeta.tags,
      estimated_minutes: yamlMeta.estimated_minutes,
      author: yamlMeta.author,
    },
    ctx,
    {
      series: lesson.series,
      course: lesson.course,
      lesson: lesson.lesson,
      status: lesson.status,
      description: lesson.description,
      tags: lesson.tags,
      estimated_minutes: lesson.estimated_minutes,
      author: lesson.author,
    },
  );

  if (!body) {
    body = defaultLessonBody(normalized.lesson);
  }

  return {
    ...lesson,
    ...metaToLessonFields(normalized),
    content: serializeLessonDocument(normalized, body),
  };
}

export function normalizeAllLessonsInSeries(seriesList: Series[]): Series[] {
  return seriesList.map((s) => ({
    ...s,
    courses: s.courses.map((c) => ({
      ...c,
      lessons: c.lessons.map((l) =>
        reconcileLesson(l, { seriesName: s.name, courseName: c.name }),
      ),
    })),
  }));
}

/** 編集モードで content 全文を保存し、パース可能な FM があれば Lesson フィールドを同期 */
export function applyLessonContentEdit(
  lesson: Lesson,
  ctx: LessonParentContext,
  content: string | undefined | null,
): Lesson {
  const text = content ?? "";
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("---")) {
    return { ...lesson, content: text };
  }
  const { meta } = parseLessonDocument(text);
  const normalized = normalizeLessonMeta(meta, ctx, {
    series: lesson.series,
    course: lesson.course,
    lesson: lesson.lesson,
    status: lesson.status,
    description: lesson.description,
    tags: lesson.tags,
    estimated_minutes: lesson.estimated_minutes,
    author: lesson.author,
  });
  return {
    ...lesson,
    ...metaToLessonFields(normalized),
    content: text,
  };
}

export function patchLessonMeta(
  lesson: Lesson,
  ctx: LessonParentContext,
  metaPatch: Partial<LessonMetaFields>,
): Lesson {
  const { body } = parseLessonDocument(lesson.content);
  const normalized = normalizeLessonMeta(
    {
      series: lesson.series,
      course: lesson.course,
      lesson: metaPatch.lesson ?? lesson.lesson,
      status: metaPatch.status ?? lesson.status,
      description: metaPatch.description ?? lesson.description,
      tags: metaPatch.tags ?? lesson.tags,
      estimated_minutes:
        metaPatch.estimated_minutes ?? lesson.estimated_minutes,
      author: metaPatch.author ?? lesson.author,
    },
    ctx,
  );
  const resolvedBody = body.trim()
    ? migrateQuizBlocksInBody(body)
    : defaultLessonBody(normalized.lesson);
  return {
    ...lesson,
    ...metaToLessonFields(normalized),
    content: serializeLessonDocument(normalized, resolvedBody),
  };
}

export function getLessonBody(lesson: Pick<Lesson, "content">): string {
  return parseLessonDocument(lesson.content).body;
}

/** 本文のみ更新し、レッスンオブジェクトのメタは現状値を正本として FM を再生成 */
export function applyLessonBodyEdit(
  lesson: Lesson,
  ctx: LessonParentContext,
  body: string,
): Lesson {
  const normalized = normalizeLessonMeta(
    {
      series: lesson.series,
      course: lesson.course,
      lesson: lesson.lesson,
      status: lesson.status,
      description: lesson.description,
      tags: lesson.tags,
      estimated_minutes: lesson.estimated_minutes,
      author: lesson.author,
    },
    ctx,
  );
  const resolvedBody = body.trim()
    ? migrateQuizBlocksInBody(body)
    : defaultLessonBody(normalized.lesson);
  return {
    ...lesson,
    content: serializeLessonDocument(normalized, resolvedBody),
  };
}
