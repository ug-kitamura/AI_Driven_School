/**
 * DX Training Studio のドメインスキーマ。
 * シリーズ → コース → レッスン の 3 層構造を Zod で定義する。
 */

import { z } from "zod";

// ===== レッスンステータス =====

export const lessonStatusSchema = z.enum(["open", "in_progress", "done"]);
export type LessonStatus = z.infer<typeof lessonStatusSchema>;

export const STATUS_LABELS: Record<LessonStatus, string> = {
  open: "未着手",
  in_progress: "作成中",
  done: "完成",
};

// ===== 公開サイト向けメタ（slug / 概要 / キャッチ / 英語版）=====

/** 公開サイトの URL に使う slug。小文字英数とハイフンのみ */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, "slug は小文字英数とハイフンのみで構成してください");

/** 表示テキストの英語版。値の書き込みは翻訳開始後（現状は器のみ） */
const localizedTextFields = {
  name_en: z.string().optional(),
  description_en: z.string().optional(),
  catch_en: z.string().optional(),
};

/** シリーズ・コースが共通で持つ公開サイト向けフィールド */
const publishingMetaFields = {
  slug: slugSchema.optional(),
  description: z.string().optional(),
  catch: z.string().optional(),
  ...localizedTextFields,
};

// ===== レッスン（葉ノード）=====

export const lessonSchema = z.object({
  /** 実行時のパス由来キー（`lesson-{series}-{course}-{lesson}`）。正本には保存しない */
  id: z.string(),
  /** frontmatter の `id`。フォルダ名を変えても変わらない安定 ID（`lsn-...`） */
  stableId: z.string().optional(),
  slug: slugSchema.optional(),
  series: z.string(),
  course: z.string(),
  lesson: z.string(),
  status: lessonStatusSchema,
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  estimated_minutes: z.number().default(0),
  author: z.string().default(""),
  content: z.string().default(""),
});
export type Lesson = z.infer<typeof lessonSchema>;

// ===== コース → レッスン（曼陀羅メタ情報を含む）=====

export const courseSchema = z.object({
  id: z.string(),
  name: z.string(),
  target: z.string().optional(),
  /** 別シリーズの前コース ID のみ。同シリーズ内の前後は series.courses[] の順序で表す */
  cross_series_prev: z.array(z.string()).default([]),
  /** 別シリーズの次コース ID のみ。同シリーズ内の前後は series.courses[] の順序で表す */
  cross_series_next: z.array(z.string()).default([]),
  lessons: z.array(lessonSchema),
  ...publishingMetaFields,
});
export type Course = z.infer<typeof courseSchema>;

// ===== シリーズ → コース =====

export const seriesSchema = z.object({
  id: z.string(),
  name: z.string(),
  courses: z.array(courseSchema),
  ...publishingMetaFields,
  /** ヒーロー画像のファイル名（正本 `images/<file>`）。シリーズのみが持つ */
  cover: z.string().optional(),
});
export type Series = z.infer<typeof seriesSchema>;

// ===== `.meta.json` のスキーマ =====

/** `contents/.meta.json`（全体） */
export const contentsMetaSchema = z.object({
  order: z.array(z.string()).default([]),
  description: z.string().optional(),
  description_en: z.string().optional(),
});
export type ContentsMeta = z.infer<typeof contentsMetaSchema>;

/** `contents/<series>/.meta.json` */
export const seriesMetaSchema = z.object({
  id: z.string().optional(),
  order: z.array(z.string()).default([]),
  ...publishingMetaFields,
  cover: z.string().optional(),
});
export type SeriesMeta = z.infer<typeof seriesMetaSchema>;

/** `contents/<series>/<course>/.meta.json` */
export const courseMetaSchema = z.object({
  id: z.string().optional(),
  order: z.array(z.string()).default([]),
  target: z.string().optional(),
  cross_series_prev: z.array(z.string()).default([]),
  cross_series_next: z.array(z.string()).default([]),
  ...publishingMetaFields,
});
export type CourseMeta = z.infer<typeof courseMetaSchema>;

// ===== 画像アセット =====

export const imageSourceSchema = z.enum(["uploaded", "ai", "web"]);
export type ImageSource = z.infer<typeof imageSourceSchema>;

export const imageStorageModeSchema = z.enum(["local", "storage"]);
export type ImageStorageMode = z.infer<typeof imageStorageModeSchema>;

export const contextStorageModeSchema = z.enum(["local", "database"]);
export type ContextStorageMode = z.infer<typeof contextStorageModeSchema>;

export const imageAssetSchema = z.object({
  path: z.string(),
  name: z.string(),
  source: imageSourceSchema,
  uploadedAt: z.string(),
});
export type ImageAsset = z.infer<typeof imageAssetSchema>;

// ===== JSON 全体用スキーマ =====

export const seriesArraySchema = z.array(seriesSchema);
export const workspaceSchema = z.object({
  name: z.string(),
  icon: z.string(),
});
