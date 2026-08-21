import {
  Label,
  StatusLabel,
  TranslationLabel,
  type TranslationBadge,
} from "@/components/Label";
import {
  formatCourseStyle,
  formatMinutes,
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
  /** 翻訳バッジ（en のみ）。`untranslated`=日本語フォールバック / `stale`=古い翻訳 */
  translation?: TranslationBadge;
  /** seriesHref を持たないページ（変更履歴）が明示するロケール */
  locale?: string;
};

/**
 * レッスン本文の上に置くラベル行。
 * 値は変換スクリプトが frontmatter に入れたものを使う（MDX 側に手を入れない）。
 * パンくずはテーマ内蔵のものを使うのでここでは描かない。
 */
export function LessonHeader({ metadata }: { metadata: LessonMetadata }) {
  const { seriesHref, lessonStatus, estimatedMinutes, courseStyle, author } =
    metadata;
  // seriesHref を持たないページ（トップ3階層・変更履歴）では、翻訳バッジが
  // 要るときだけ描く。ロケールは frontmatter の `locale` を使う（変更履歴の
  // 英語フォールバックが `locale: "en"` を明示する）
  if (!seriesHref && !metadata.translation) return null;

  const locale = seriesHref
    ? localeOf(seriesHref)
    : metadata.locale === "en"
      ? "en"
      : "ja";
  const styleLabel = formatCourseStyle(courseStyle, locale);
  const hasLabels = Boolean(lessonStatus || estimatedMinutes || styleLabel);

  if (!hasLabels && !author && !metadata.translation) return null;

  return (
    <div className="dxm-lesson-header">
      <div className="dxm-lesson-labels">
        {lessonStatus && <StatusLabel status={lessonStatus} locale={locale} />}
        {estimatedMinutes ? (
          <Label kind="minutes">{formatMinutes(estimatedMinutes, locale)}</Label>
        ) : null}
        {styleLabel && <Label kind="style">{styleLabel}</Label>}
        {metadata.translation && (
          <TranslationLabel state={metadata.translation} locale="en" />
        )}
      </div>
      {author && (
        <span className="dxm-lesson-author">
          {locale === "en" ? "author" : "著者"}: {author}
        </span>
      )}
    </div>
  );
}
