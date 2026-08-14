import siteData from "@/content/site-data.json";
import type { Locale } from "./locale-path";

export type LessonStatus = "open" | "in_progress" | "done";

export type SiteLesson = {
  name: string;
  slug: string;
  stableId?: string;
  status: LessonStatus;
  description: string;
  estimatedMinutes: number;
  untranslated: boolean;
  href: string;
  titleEn?: string;
};

export type SiteCourse = {
  name: string;
  nameEn?: string;
  id?: string;
  slug: string;
  description?: string;
  descriptionEn?: string;
  catch?: string;
  catchEn?: string;
  target?: string;
  crossSeriesPrev: string[];
  crossSeriesNext: string[];
  lessons: SiteLesson[];
  href: string;
  totalMinutes: number;
};

export type SiteSeries = {
  name: string;
  nameEn?: string;
  id?: string;
  slug: string;
  description?: string;
  descriptionEn?: string;
  catch?: string;
  catchEn?: string;
  cover?: string;
  courses: SiteCourse[];
  href: string;
  totalMinutes: number;
  lessonCount: number;
};

export type MandalaNode = {
  id: string;
  label: string;
  seriesSlug: string;
  seriesName: string;
  courseSlug: string;
  href: string;
  catch?: string;
  lessonCount: number;
  totalMinutes: number;
  status: LessonStatus;
};

export type MandalaEdge = {
  id: string;
  source: string;
  target: string;
  kind: "order" | "cross";
};

export type MandalaGraph = { nodes: MandalaNode[]; edges: MandalaEdge[] };

export type SiteData = {
  siteDescription?: string;
  siteDescriptionEn?: string;
  series: SiteSeries[];
  mandala: MandalaGraph;
};

export const data = siteData as SiteData;

export function allSeries(): SiteSeries[] {
  return data.series;
}

export function findSeries(slug: string): SiteSeries | undefined {
  return data.series.find((s) => s.slug === slug);
}

export function findCourse(
  seriesSlug: string,
  courseSlug: string,
): SiteCourse | undefined {
  return findSeries(seriesSlug)?.courses.find((c) => c.slug === courseSlug);
}

/** 表示テキストのロケール解決（英語が無ければ日本語へフォールバック） */
export function localized(
  ja: string,
  en: string | undefined,
  locale: Locale,
): string {
  return locale === "en" ? (en ?? ja) : ja;
}

export function localizedOptional(
  ja: string | undefined,
  en: string | undefined,
  locale: Locale,
): string | undefined {
  return locale === "en" ? (en ?? ja) : ja;
}

export function formatMinutes(minutes: number, locale: Locale): string {
  return locale === "en" ? `${minutes} min` : `${minutes}分`;
}
