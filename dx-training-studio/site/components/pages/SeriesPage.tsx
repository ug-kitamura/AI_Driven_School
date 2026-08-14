import Link from "next/link";
import { Mandala } from "@/components/mandala/Mandala";
import {
  formatMinutes,
  localized,
  localizedOptional,
  type SiteSeries,
} from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";

export function SeriesPage({
  series,
  locale,
}: {
  series: SiteSeries;
  locale: Locale;
}) {
  const title = localized(series.name, series.nameEn, locale);
  const firstLesson = series.courses.flatMap((c) => c.lessons)[0];

  return (
    <div className="dxm-page">
      <div className="dxm-hero">
        {series.catch && (
          <span className="dxm-hero-catch">
            {localizedOptional(series.catch, series.catchEn, locale)}
          </span>
        )}
        <h1 className="dxm-hero-title">{title}</h1>
        {series.description && (
          <p>
            {localizedOptional(
              series.description,
              series.descriptionEn,
              locale,
            )}
          </p>
        )}
        {firstLesson && (
          <Link
            className="dxm-hero-cta"
            href={localizedHref(firstLesson.href, locale)}
          >
            {locale === "en" ? "Start the first lesson" : "最初のレッスンへ"}
          </Link>
        )}
      </div>

      <h2 className="dxm-section-title">
        {locale === "en" ? "Course map" : "このシリーズの曼陀羅"}
      </h2>
      <Mandala
        scope={{ kind: "series", seriesSlug: series.slug }}
        locale={locale}
      />

      <h2 className="dxm-section-title">
        {locale === "en" ? "Courses" : "コース"}
      </h2>
      <div className="dxm-card-list">
        {series.courses.map((course) => (
          <Link
            key={course.slug}
            href={localizedHref(course.href, locale)}
            className="dxm-card"
          >
            <span className="dxm-card-title">
              {localized(course.name, course.nameEn, locale)}
            </span>
            {course.catch && (
              <span className="dxm-card-catch">
                {localizedOptional(course.catch, course.catchEn, locale)}
              </span>
            )}
            {course.description && (
              <span>
                {localizedOptional(
                  course.description,
                  course.descriptionEn,
                  locale,
                )}
              </span>
            )}
            <span className="dxm-card-meta">
              {course.lessons.length} {locale === "en" ? "lessons" : "レッスン"}
              ・{formatMinutes(course.totalMinutes, locale)}
              {course.target &&
                ` ・${locale === "en" ? "For" : "対象"}: ${course.target}`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
