import { UntranslatedBadge } from "@/components/StatusBadge";
import {
  formatCourseStyle,
  formatMinutes,
  formatPreparationLabel,
  type CourseStyle,
  type LessonStatus,
} from "@/lib/site-data";
import { localeOf } from "@/lib/locale-path";

export type LessonMetadata = {
  title?: string;
  seriesName?: string;
  seriesHref?: string;
  courseName?: string;
  courseHref?: string;
  lessonStatus?: LessonStatus;
  estimatedMinutes?: number;
  courseStyle?: CourseStyle;
  author?: string;
  untranslated?: boolean;
};

/**
 * レッスン本文の上に置くラベル行。
 * 値は変換スクリプトが frontmatter に入れたものを使う（MDX 側に手を入れない）。
 * パンくずはテーマ内蔵のものを使うのでここでは描かない。
 */
export function LessonHeader({ metadata }: { metadata: LessonMetadata }) {
  const { seriesHref, lessonStatus, estimatedMinutes, courseStyle, author } =
    metadata;
  if (!seriesHref) return null;

  const locale = localeOf(seriesHref);
  const labels = [
    lessonStatus && formatPreparationLabel(lessonStatus, locale),
    estimatedMinutes ? formatMinutes(estimatedMinutes, locale) : undefined,
    formatCourseStyle(courseStyle, locale),
  ].filter(Boolean) as string[];

  if (labels.length === 0 && !author && !metadata.untranslated) return null;

  return (
    <div className="dxm-lesson-header">
      <div className="dxm-lesson-labels">
        {labels.map((label) => (
          <span key={label} className="dxm-label">
            {label}
          </span>
        ))}
        {metadata.untranslated && <UntranslatedBadge locale="en" />}
      </div>
      {author && <span className="dxm-lesson-author">written by {author}</span>}
    </div>
  );
}
