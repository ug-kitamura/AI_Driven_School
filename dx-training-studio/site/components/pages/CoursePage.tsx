import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Mandala } from "@/components/mandala/Mandala";
import { StatusBadge } from "@/components/StatusBadge";
import {
  formatMinutes,
  localized,
  localizedOptional,
  type SiteCourse,
  type SiteSeries,
} from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";

export function CoursePage({
  series,
  course,
  locale,
}: {
  series: SiteSeries;
  course: SiteCourse;
  locale: Locale;
}) {
  const seriesTitle = localized(series.name, series.nameEn, locale);
  const courseTitle = localized(course.name, course.nameEn, locale);

  return (
    <div className="dxm-page">
      <Breadcrumbs
        items={[
          { label: seriesTitle, href: localizedHref(series.href, locale) },
          { label: courseTitle, href: localizedHref(course.href, locale) },
        ]}
      />

      <div className="dxm-hero">
        {course.catch && (
          <span className="dxm-hero-catch">
            {localizedOptional(course.catch, course.catchEn, locale)}
          </span>
        )}
        <h1 className="dxm-hero-title">{courseTitle}</h1>
        {course.description && (
          <p>
            {localizedOptional(
              course.description,
              course.descriptionEn,
              locale,
            )}
          </p>
        )}
        <span className="dxm-card-meta">
          {course.lessons.length} {locale === "en" ? "lessons" : "レッスン"}・
          {formatMinutes(course.totalMinutes, locale)}
          {course.target &&
            ` ・${locale === "en" ? "For" : "対象"}: ${course.target}`}
        </span>
      </div>

      {course.id && (
        <>
          <h2 className="dxm-section-title">
            {locale === "en" ? "Where you are" : "前後のコース"}
          </h2>
          <Mandala
            scope={{ kind: "course", courseId: course.id }}
            locale={locale}
            height={360}
          />
        </>
      )}

      <h2 className="dxm-section-title">
        {locale === "en" ? "Lessons" : "レッスン"}
      </h2>
      <div className="dxm-card-list">
        {course.lessons.map((lesson) => (
          <Link
            key={lesson.slug}
            href={localizedHref(lesson.href, locale)}
            className="dxm-card"
          >
            <span className="dxm-card-title">
              {locale === "en" ? (lesson.titleEn ?? lesson.name) : lesson.name}
              <StatusBadge status={lesson.status} locale={locale} />
            </span>
            {lesson.description && <span>{lesson.description}</span>}
            <span className="dxm-card-meta">
              {formatMinutes(lesson.estimatedMinutes, locale)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
