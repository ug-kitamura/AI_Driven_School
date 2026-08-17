"use client";

import { COURSE_STYLE_LABELS, STATUS_LABELS } from "@/lib/schema";
import type { Course, Lesson } from "@/lib/schema";

/**
 * プレビュー本文の上に出すレッスンメタのラベル行。
 * デザインは公開サイト（mandala）のレッスンページのラベル行と同一
 * （状態=赤系 / 所要時間=緑系 / 受講形態=青系、右端に著者）。
 * 受講形態だけはコースメタ（style）から取る。
 */
export function LessonPreviewMetaRow({
  lesson,
  course,
}: {
  lesson: Lesson;
  course: Course | undefined;
}) {
  // 公開サイトと同じく「完成」はラベルを出さない
  const statusLabel =
    lesson.status === "done" ? undefined : STATUS_LABELS[lesson.status];
  const minutesLabel =
    lesson.estimated_minutes > 0 ? `${lesson.estimated_minutes}分` : undefined;
  const styleLabel = course?.style
    ? COURSE_STYLE_LABELS[course.style]
    : undefined;
  const author = lesson.author.trim();

  if (!statusLabel && !minutesLabel && !styleLabel && !author) return null;

  return (
    <div className="lesson-preview-meta">
      <div className="lesson-preview-meta-labels">
        {statusLabel ? (
          <span className="lesson-preview-meta-label lesson-preview-meta-status">
            {statusLabel}
          </span>
        ) : null}
        {minutesLabel ? (
          <span className="lesson-preview-meta-label lesson-preview-meta-minutes">
            {minutesLabel}
          </span>
        ) : null}
        {styleLabel ? (
          <span className="lesson-preview-meta-label lesson-preview-meta-style">
            {styleLabel}
          </span>
        ) : null}
      </div>
      {author ? (
        <span className="lesson-preview-meta-author">著者: {author}</span>
      ) : null}
    </div>
  );
}
