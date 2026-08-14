import Link from "next/link";
import Image from "next/image";
import { Mandala } from "@/components/mandala/Mandala";
import heroImage from "@/app/hero.jpg";
import {
  allSeries,
  data,
  formatMinutes,
  localized,
  localizedOptional,
} from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";
import siteConfig from "@/site.config.json";

export function HomePage({ locale }: { locale: Locale }) {
  const description = localizedOptional(
    data.siteDescription,
    data.siteDescriptionEn,
    locale,
  );

  return (
    <div className="dxm-page">
      {/* トレーニングを想起させるヒーロー画像。差し替えは `app/hero.jpg` を
          同名で置き換えるだけでよい（コード変更は不要）。
          切り抜かず全体を出すので、縦横比は画像がそのまま決める。 */}
      <Image
        src={heroImage}
        alt=""
        aria-hidden
        priority
        className="dxm-home-hero-image"
      />

      <div className="dxm-hero">
        <h1 className="dxm-hero-title">{siteConfig.siteName}</h1>
        {description && <p>{description}</p>}
      </div>

      <h2 className="dxm-section-title">
        {locale === "en" ? "All courses" : "全体の曼陀羅"}
      </h2>
      <Mandala scope={{ kind: "global" }} locale={locale} />

      <h2 className="dxm-section-title">
        {locale === "en" ? "Series" : "シリーズ"}
      </h2>
      <div className="dxm-card-list">
        {allSeries().map((series) => (
          <Link
            key={series.slug}
            href={localizedHref(series.href, locale)}
            className="dxm-card"
          >
            <span className="dxm-card-title">
              {localized(series.name, series.nameEn, locale)}
            </span>
            {series.catch && (
              <span className="dxm-card-catch">
                {localizedOptional(series.catch, series.catchEn, locale)}
              </span>
            )}
            {series.description && (
              <span>
                {localizedOptional(
                  series.description,
                  series.descriptionEn,
                  locale,
                )}
              </span>
            )}
            <span className="dxm-card-meta">
              {series.courses.length} {locale === "en" ? "courses" : "コース"}・
              {series.lessonCount} {locale === "en" ? "lessons" : "レッスン"}・
              {formatMinutes(series.totalMinutes, locale)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
