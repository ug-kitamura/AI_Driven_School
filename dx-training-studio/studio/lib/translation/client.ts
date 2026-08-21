"use client";

/**
 * 翻訳まわりのクライアント側フェッチヘルパー（studio-translation spec）。
 * コンポーネントを薄く保つため、API の形はここに集約する。
 */
import { aiRequestHeaders } from "@/lib/agent-request-headers";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";

export type TranslationFreshness = "untranslated" | "fresh" | "stale";
export type UnitLevel = "root" | "series" | "course" | "lesson";

export type TranslationStatuses = {
  statuses: Partial<
    Record<UnitLevel, { meta: TranslationFreshness; body?: TranslationFreshness }>
  >;
  changelog: TranslationFreshness | null;
};

export type UnitNames = { series?: string; course?: string; lesson?: string };

function unitQuery(names: UnitNames): string {
  const params = new URLSearchParams();
  if (names.series) params.set("series", names.series);
  if (names.course) params.set("course", names.course);
  if (names.lesson) params.set("lesson", names.lesson);
  return params.toString();
}

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function fetchTranslationStatus(
  names: UnitNames,
): Promise<TranslationStatuses> {
  const res = await fetch(`/api/content/translation-status?${unitQuery(names)}`);
  return readJson<TranslationStatuses>(res);
}

export type MetaEnData = {
  ja: Record<string, string>;
  en: Record<string, string>;
  en_source_hash: string | null;
  author_en?: string;
};

export async function fetchMetaEn(
  level: UnitLevel,
  names: UnitNames,
): Promise<MetaEnData> {
  const res = await fetch(
    `/api/content/meta-en?level=${level}&${unitQuery(names)}`,
  );
  return readJson<MetaEnData>(res);
}

export async function saveMetaEn(args: {
  level: UnitLevel;
  names: UnitNames;
  fields: Record<string, string>;
  enSourceHash?: string;
}): Promise<void> {
  const res = await fetch("/api/content/meta-en", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level: args.level,
      ...args.names,
      fields: args.fields,
      ...(args.enSourceHash !== undefined
        ? { en_source_hash: args.enSourceHash }
        : {}),
    }),
  });
  await readJson(res);
}

export async function translateMeta(
  level: UnitLevel,
  names: UnitNames,
): Promise<{ fields: Record<string, string>; en_source_hash: string }> {
  const res = await fetch("/api/content/translate/meta", {
    method: "POST",
    headers: aiRequestHeaders(loadWorkspaceSettings()),
    body: JSON.stringify({ level, ...names }),
  });
  return readJson(res);
}

export async function translateLessonBody(
  names: Required<UnitNames>,
): Promise<{ body: string; sourceHash: string }> {
  const res = await fetch("/api/content/translate/lesson-body", {
    method: "POST",
    headers: aiRequestHeaders(loadWorkspaceSettings()),
    body: JSON.stringify(names),
  });
  return readJson(res);
}

export async function translateChangelog(): Promise<{
  kind: "entries" | "full";
  text: string;
}> {
  const res = await fetch("/api/content/translate/changelog", {
    method: "POST",
    headers: aiRequestHeaders(loadWorkspaceSettings()),
    body: JSON.stringify({}),
  });
  return readJson(res);
}

export async function fetchLessonEnBody(
  names: Required<UnitNames>,
): Promise<{ exists: boolean; body: string; sourceHash: string | null }> {
  const res = await fetch(`/api/content/lesson-en?${unitQuery(names)}`);
  return readJson(res);
}

export async function saveLessonEnBody(args: {
  names: Required<UnitNames>;
  content: string;
  sourceHash?: string;
}): Promise<void> {
  const res = await fetch("/api/content/save-lesson", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...args.names,
      content: args.content,
      language: "en",
      ...(args.sourceHash ? { sourceHash: args.sourceHash } : {}),
    }),
  });
  await readJson(res);
}

/** レッスンの鮮度は本文とメタの悪いほうを採る（spec） */
export function worstFreshness(
  a: TranslationFreshness | undefined,
  b: TranslationFreshness | undefined,
): TranslationFreshness | undefined {
  const order: TranslationFreshness[] = ["untranslated", "stale", "fresh"];
  const values = [a, b].filter((v): v is TranslationFreshness => v !== undefined);
  if (values.length === 0) return undefined;
  return values.sort((x, y) => order.indexOf(x) - order.indexOf(y))[0];
}
