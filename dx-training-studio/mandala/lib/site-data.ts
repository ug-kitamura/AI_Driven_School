import siteData from "@/content/site-data.json";
import type { Locale } from "./locale-path";

export type LessonStatus = "open" | "in_progress" | "done";

/** コースの受講形態。正本 `.meta.json` の `style` */
export type CourseStyle = "self-study" | "lecture" | "hands-on";

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
  isStart?: boolean;
  isGoal?: boolean;
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
  style?: CourseStyle;
  /** カリキュラムの入口・到達点の宣言。未宣言ではキーを持たない */
  isStart?: boolean;
  isGoal?: boolean;
};

export type MandalaEdge = {
  id: string;
  source: string;
  target: string;
  kind: "order" | "cross";
};

export type MandalaGraph = { nodes: MandalaNode[]; edges: MandalaEdge[] };

/** サイト表示フィールド（変換が全体メタ＋ site.config.json から解決した値） */
export type SiteChrome = {
  name: string;
  nameEn?: string;
  githubUrl: string;
  /** 全体メタ由来のヒーロー画像ファイル名。未設定（同梱 hero.jpg）なら null */
  hero: string | null;
};

export type SiteData = {
  site?: SiteChrome;
  siteDescription?: string;
  siteDescriptionEn?: string;
  series: SiteSeries[];
  mandala: MandalaGraph;
};

export const data = siteData as SiteData;

/** 旧形式の site-data.json（site 無し）でも落とさないためのフォールバック */
const FALLBACK_CHROME: SiteChrome = {
  name: "DX Training Mandala",
  githubUrl: "https://github.com/ug-kitamura/AI_Driven_School",
  hero: null,
};

export function siteChrome(): SiteChrome {
  return data.site ?? FALLBACK_CHROME;
}

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

const COURSE_STYLE_LABELS_JA: Record<CourseStyle, string> = {
  "self-study": "独習",
  lecture: "講義",
  "hands-on": "ハンズオン",
};

/** 受講形態の表示ラベル。英語は値そのまま（小文字） */
export function formatCourseStyle(
  style: CourseStyle | undefined,
  locale: Locale,
): string | undefined {
  if (!style) return undefined;
  return locale === "en" ? style : COURSE_STYLE_LABELS_JA[style];
}

/**
 * 執筆状況の表示ラベル。語彙は Studio（`lib/schema.ts`）に揃える——
 * 目次でもレッスンページでも同じ言葉を出すため、対応はここ1箇所だけに置く。
 * `done` はどちらにも表示しない。
 */
const LESSON_STATUS_LABELS: Record<
  Exclude<LessonStatus, "done">,
  { ja: string; en: string }
> = {
  open: { ja: "未着手", en: "open" },
  in_progress: { ja: "作成中", en: "in progress" },
};

export function formatLessonStatus(
  status: LessonStatus,
  locale: Locale,
): string | undefined {
  if (status === "done") return undefined;
  return LESSON_STATUS_LABELS[status][locale];
}
