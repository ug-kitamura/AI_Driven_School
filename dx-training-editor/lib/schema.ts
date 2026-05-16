/**
 * DX Training Editor のドメインスキーマ。
 * シリーズ → コース → レッスン の 3 層構造を Zod で定義する。
 */

import { z } from "zod";

// ===== レッスンステータス =====

export const lessonStatusSchema = z.enum(["draft", "in_progress", "done"]);
export type LessonStatus = z.infer<typeof lessonStatusSchema>;

export const STATUS_LABELS: Record<LessonStatus, string> = {
  draft: "未着手",
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
  estimated_minutes: z.number().default(15),
  author: z.string().default(""),
  content: z.string().default(""),
});
export type Lesson = z.infer<typeof lessonSchema>;

// ===== コース → レッスン（曼陀羅メタ情報を含む）=====

export const courseSchema = z.object({
  id: z.string(),
  name: z.string(),
  target_audience: z.string().optional(),
  prerequisites: z.array(z.string()).default([]),
  next_courses: z.array(z.string()).default([]),
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

export const imageAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  dataUrl: z.string(),
  uploadedAt: z.string(),
});
export type ImageAsset = z.infer<typeof imageAssetSchema>;

// ===== JSON 全体用スキーマ =====

export const seriesArraySchema = z.array(seriesSchema);
export const imageAssetsSchema = z.array(imageAssetSchema);
export const workspaceSchema = z.object({
  name: z.string(),
  icon: z.string(),
});
