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

// ===== レッスン（葉ノード）=====

export const lessonSchema = z.object({
  id: z.string(),
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
});
export type Course = z.infer<typeof courseSchema>;

// ===== シリーズ → コース =====

export const seriesSchema = z.object({
  id: z.string(),
  name: z.string(),
  courses: z.array(courseSchema),
});
export type Series = z.infer<typeof seriesSchema>;

// ===== 画像アセット =====

export const imageSourceSchema = z.enum(["uploaded", "ai", "web"]);
export type ImageSource = z.infer<typeof imageSourceSchema>;

export const imageStorageModeSchema = z.enum(["local", "storage"]);
export type ImageStorageMode = z.infer<typeof imageStorageModeSchema>;

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
