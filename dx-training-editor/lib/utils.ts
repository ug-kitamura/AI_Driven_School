import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LessonStatus } from "@/lib/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 配下レッスンのステータス一覧からコース/シリーズのステータスを自動計算する。
 * - すべて draft → draft
 * - すべて done → done
 * - それ以外（作成中または完成が 1 つ以上）→ in_progress
 */
export function computeStatus(statuses: LessonStatus[]): LessonStatus {
  if (statuses.length === 0) return "draft";
  if (statuses.every((s) => s === "draft")) return "draft";
  if (statuses.every((s) => s === "done")) return "done";
  return "in_progress";
}
