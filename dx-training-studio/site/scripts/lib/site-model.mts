/**
 * 正本の読み取り結果から、サイトが使うモデル（URL 付きツリー＋曼陀羅グラフ）を組み立てる。
 * 副作用は持たない——ファイル入出力は呼び出し側（build-content.mts）が行う。
 */
import type {
  ContentsRoot,
  CourseMeta,
  CourseStyle,
  LessonStatus,
  SeriesMeta,
} from "./content-source.mts";

/** `lib/schema.ts` の SLUG_PATTERN と同じ */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type SlugIssue = {
  /** 正本上の位置（エラーメッセージ用） */
  path: string;
  reason: "missing" | "invalid" | "duplicate";
  slug?: string;
};

export type SiteLesson = {
  name: string;
  slug: string;
  stableId?: string;
  status: LessonStatus;
  description: string;
  estimatedMinutes: number;
  body: string;
  bodyEn?: string;
  titleEn?: string;
  /** 英語版が無い（日本語へフォールバックする） */
  untranslated: boolean;
  /** `/git/concepts/what-is-version-control` */
  href: string;
  dir: string;
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
  style?: CourseStyle;
  crossSeriesPrev: string[];
  crossSeriesNext: string[];
  lessons: SiteLesson[];
  /** `/git/concepts` */
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
  /** `/git` */
  href: string;
  totalMinutes: number;
  lessonCount: number;
};

export type MandalaNode = {
  /** コース ID（無ければ href を代用） */
  id: string;
  label: string;
  seriesSlug: string;
  seriesName: string;
  courseSlug: string;
  href: string;
  catch?: string;
  lessonCount: number;
  totalMinutes: number;
  /** コース内レッスンの status 集計から決まる代表状態 */
  status: LessonStatus;
  /** コースの受講形態（未設定なら無し） */
  style?: CourseStyle;
};

export type MandalaEdge = {
  id: string;
  source: string;
  target: string;
  /** `order`=同一シリーズ内の並び / `cross`=シリーズ跨ぎ */
  kind: "order" | "cross";
};

export type MandalaGraph = {
  nodes: MandalaNode[];
  edges: MandalaEdge[];
};

export type SiteData = {
  siteDescription?: string;
  siteDescriptionEn?: string;
  series: SiteSeries[];
  mandala: MandalaGraph;
};

/** コース内レッスンの status を1つに畳む（全 done なら done、1つでも着手済みなら in_progress） */
function aggregateStatus(statuses: LessonStatus[]): LessonStatus {
  if (statuses.length === 0) return "open";
  if (statuses.every((s) => s === "done")) return "done";
  if (statuses.some((s) => s === "done" || s === "in_progress"))
    return "in_progress";
  return "open";
}

/**
 * 全階層の slug を検証する。
 * 欠落・形式違反・兄弟間重複をすべて集めて返す（1件目で止めない——まとめて直せるように）。
 */
export function validateSlugs(root: ContentsRoot): SlugIssue[] {
  const issues: SlugIssue[] = [];

  const checkSlug = (
    slug: string | undefined,
    where: string,
    siblings: Map<string, number>,
  ) => {
    if (!slug) {
      issues.push({ path: where, reason: "missing" });
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      issues.push({ path: where, reason: "invalid", slug });
      return;
    }
    const count = (siblings.get(slug) ?? 0) + 1;
    siblings.set(slug, count);
    if (count > 1) {
      issues.push({ path: where, reason: "duplicate", slug });
    }
  };

  const seriesSlugs = new Map<string, number>();
  for (const series of root.series) {
    checkSlug(series.slug, series.name, seriesSlugs);

    const courseSlugs = new Map<string, number>();
    for (const course of series.courses) {
      checkSlug(course.slug, `${series.name}/${course.name}`, courseSlugs);

      const lessonSlugs = new Map<string, number>();
      for (const lesson of course.lessons) {
        checkSlug(
          lesson.slug,
          `${series.name}/${course.name}/${lesson.name}`,
          lessonSlugs,
        );
      }
    }
  }

  return issues;
}

export function formatSlugIssues(issues: SlugIssue[]): string {
  const lines = issues.map((issue) => {
    switch (issue.reason) {
      case "missing":
        return `  - ${issue.path}: slug が設定されていません`;
      case "invalid":
        return `  - ${issue.path}: slug "${issue.slug}" は形式が不正です（小文字英数とハイフンのみ）`;
      case "duplicate":
        return `  - ${issue.path}: slug "${issue.slug}" が同じ階層で重複しています`;
    }
  });
  return [
    `公開サイトの URL を決められないため変換を中止しました（${issues.length} 件）:`,
    ...lines,
    "",
    "シリーズ・コースは .meta.json の slug、レッスンは contents.md の frontmatter の slug を修正してください。",
  ].join("\n");
}

function buildCourse(seriesSlug: string, course: CourseMeta): SiteCourse {
  const courseSlug = course.slug!;
  const href = `/${seriesSlug}/${courseSlug}`;
  const lessons: SiteLesson[] = course.lessons.map((lesson) => ({
    name: lesson.name,
    slug: lesson.slug!,
    stableId: lesson.id,
    status: lesson.status,
    description: lesson.description,
    estimatedMinutes: lesson.estimatedMinutes,
    body: lesson.body,
    bodyEn: lesson.bodyEn,
    titleEn: lesson.titleEn,
    untranslated: lesson.bodyEn === undefined,
    href: `${href}/${lesson.slug}`,
    dir: lesson.dir,
  }));

  return {
    name: course.name,
    nameEn: course.nameEn,
    id: course.id,
    slug: courseSlug,
    description: course.description,
    descriptionEn: course.descriptionEn,
    catch: course.catch,
    catchEn: course.catchEn,
    target: course.target,
    style: course.style,
    crossSeriesPrev: course.crossSeriesPrev,
    crossSeriesNext: course.crossSeriesNext,
    lessons,
    href,
    totalMinutes: lessons.reduce((sum, l) => sum + l.estimatedMinutes, 0),
  };
}

function buildSeries(series: SeriesMeta): SiteSeries {
  const seriesSlug = series.slug!;
  const courses = series.courses.map((course) =>
    buildCourse(seriesSlug, course),
  );

  return {
    name: series.name,
    nameEn: series.nameEn,
    id: series.id,
    slug: seriesSlug,
    description: series.description,
    descriptionEn: series.descriptionEn,
    catch: series.catch,
    catchEn: series.catchEn,
    cover: series.cover,
    courses,
    href: `/${seriesSlug}`,
    totalMinutes: courses.reduce((sum, c) => sum + c.totalMinutes, 0),
    lessonCount: courses.reduce((sum, c) => sum + c.lessons.length, 0),
  };
}

/** 曼陀羅グラフ（ノード＝コース、辺＝同一シリーズの並び＋シリーズ跨ぎ） */
export function buildMandalaGraph(series: SiteSeries[]): MandalaGraph {
  const nodes: MandalaNode[] = [];
  const byCourseId = new Map<string, MandalaNode>();

  for (const s of series) {
    for (const course of s.courses) {
      const node: MandalaNode = {
        id: course.id ?? course.href,
        label: course.name,
        seriesSlug: s.slug,
        seriesName: s.name,
        courseSlug: course.slug,
        href: course.href,
        catch: course.catch,
        lessonCount: course.lessons.length,
        totalMinutes: course.totalMinutes,
        status: aggregateStatus(course.lessons.map((l) => l.status)),
        style: course.style,
      };
      nodes.push(node);
      if (course.id) byCourseId.set(course.id, node);
    }
  }

  const edges: MandalaEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (
    source: string,
    target: string,
    kind: MandalaEdge["kind"],
  ) => {
    const id = `${source}__${target}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ id, source, target, kind });
  };

  for (const s of series) {
    // 同一シリーズ内は order の並びが辺になる
    for (let i = 0; i < s.courses.length - 1; i++) {
      const from = s.courses[i]!;
      const to = s.courses[i + 1]!;
      addEdge(from.id ?? from.href, to.id ?? to.href, "order");
    }
    // シリーズ跨ぎは cross_series_prev / next（相手が存在する場合のみ）
    for (const course of s.courses) {
      const selfId = course.id ?? course.href;
      for (const prevId of course.crossSeriesPrev) {
        if (byCourseId.has(prevId)) addEdge(prevId, selfId, "cross");
      }
      for (const nextId of course.crossSeriesNext) {
        if (byCourseId.has(nextId)) addEdge(selfId, nextId, "cross");
      }
    }
  }

  return { nodes, edges };
}

/** 検証済みの正本からサイトモデルを組み立てる。slug 未検証のまま呼んではいけない */
export function buildSiteData(root: ContentsRoot): SiteData {
  const series = root.series.map(buildSeries);
  return {
    siteDescription: root.description,
    siteDescriptionEn: root.descriptionEn,
    series,
    mandala: buildMandalaGraph(series),
  };
}
