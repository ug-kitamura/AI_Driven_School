import { Breadcrumbs } from "@/components/Breadcrumbs";
import { StatusBadge, UntranslatedBadge } from "@/components/StatusBadge";
import type { LessonStatus } from "@/lib/site-data";
import { localeOf } from "@/lib/locale-path";

export type LessonMetadata = {
  title?: string;
  seriesName?: string;
  seriesHref?: string;
  courseName?: string;
  courseHref?: string;
  lessonStatus?: LessonStatus;
  untranslated?: boolean;
};

/**
 * レッスンページの上に置くパンくずとバッジ。
 * 値は変換スクリプトが frontmatter に入れたものを使う（MDX 側に手を入れない）。
 */
export function LessonHeader({ metadata }: { metadata: LessonMetadata }) {
  const { seriesName, seriesHref, courseName, courseHref, title } = metadata;
  if (!seriesName || !seriesHref || !courseName || !courseHref) return null;

  const locale = localeOf(seriesHref);

  return (
    <div className="dxm-lesson-header">
      <Breadcrumbs
        items={[
          { label: seriesName, href: seriesHref },
          { label: courseName, href: courseHref },
          ...(title ? [{ label: title, href: "#" }] : []),
        ]}
      />
      <div className="dxm-lesson-badges">
        {metadata.lessonStatus && (
          <StatusBadge status={metadata.lessonStatus} locale={locale} />
        )}
        {metadata.untranslated && <UntranslatedBadge locale="en" />}
      </div>
    </div>
  );
}
