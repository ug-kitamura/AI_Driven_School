/**
 * サイトモデルから Nextra の入力（`content/` 配下の `.md` と `_meta.js`）を組み立てる。
 * 文字列を作るところまでを純関数で行い、書き出しは build-content.mts が担う。
 */
import type {
  SiteCourse,
  SiteData,
  SiteLesson,
  SiteSeries,
} from "./site-model.mts";

export type Locale = "ja" | "en";

export type EmittedFile = {
  /** `content/` からの相対パス */
  relativePath: string;
  contents: string;
};

/** YAML の値として安全に出す（1行・コロンや引用符を含みうるため常にクォート） */
function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** レッスン 1 本の `.md`（Nextra 用 frontmatter ＋ 本文） */
export function emitLessonMarkdown(
  lesson: SiteLesson,
  series: SiteSeries,
  course: SiteCourse,
  locale: Locale,
  body: string,
): string {
  const title = locale === "en" ? (lesson.titleEn ?? lesson.name) : lesson.name;
  const untranslated = locale === "en" && lesson.untranslated;

  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `description: ${yamlString(lesson.description)}`,
    `lessonStatus: ${lesson.status}`,
    `estimatedMinutes: ${lesson.estimatedMinutes}`,
    // ラベル行が使う。コースの受講形態は未設定なら出さない
    ...(lesson.author ? [`author: ${yamlString(lesson.author)}`] : []),
    ...(course.style ? [`courseStyle: ${course.style}`] : []),
    `seriesName: ${yamlString(locale === "en" ? (series.nameEn ?? series.name) : series.name)}`,
    `seriesHref: ${yamlString(localizedHref(series.href, locale))}`,
    `courseName: ${yamlString(locale === "en" ? (course.nameEn ?? course.name) : course.name)}`,
    `courseHref: ${yamlString(localizedHref(course.href, locale))}`,
    ...(untranslated ? ["untranslated: true"] : []),
    ...(lesson.stableId ? [`lessonId: ${yamlString(lesson.stableId)}`] : []),
    "---",
  ].join("\n");

  return `${frontmatter}\n\n${body.replace(/^\n+/, "")}`;
}

/**
 * トップページの `index.mdx`。
 *
 * Next.js は同階層に `[series]` と Nextra の `[[...mdxPath]]` を共存できないため、
 * トップ3階層も content ツリーに置き、MDX からコンポーネントを呼ぶ。
 */
export function emitIndexMdx(
  kind: "home" | "series" | "course",
  args: {
    title: string;
    description?: string;
    seriesSlug?: string;
    courseSlug?: string;
  },
  locale: Locale,
): string {
  const frontmatter = [
    "---",
    `title: ${yamlString(args.title)}`,
    ...(args.description
      ? [`description: ${yamlString(args.description)}`]
      : []),
    // トップページは目次なので本文の見出し一覧（TOC）を出さない
    "sidebarTitle: " + yamlString(args.title),
    // フォルダ自身をページにする（サイドバーに「概要」の独立項目を出さないため）。
    // 全体トップはフォルダではなくルートなので付けない。
    ...(kind === "home" ? [] : ["asIndexPage: true"]),
    "---",
  ].join("\n");

  const localeProp = `locale="${locale}"`;
  const call =
    kind === "home"
      ? `<SiteHome ${localeProp} />`
      : kind === "series"
        ? `<SiteSeries seriesSlug="${args.seriesSlug}" ${localeProp} />`
        : `<SiteCourse seriesSlug="${args.seriesSlug}" courseSlug="${args.courseSlug}" ${localeProp} />`;

  const componentName =
    kind === "home"
      ? "SiteHome"
      : kind === "series"
        ? "SiteSeries"
        : "SiteCourse";

  return `${frontmatter}\n\nimport { ${componentName} } from "@/components/pages"\n\n${call}\n`;
}

/**
 * `_meta.js`（slug キー → 表示名。並びはオブジェクトのキー順）。
 *
 * `theme` を持つ項目は Nextra のページ設定オブジェクトとして出す
 * （例: トップページのパンくずを消す）。
 */
export function emitMetaFile(
  entries: Array<{
    slug: string;
    title: string;
    theme?: Record<string, unknown>;
  }>,
): string {
  const body = entries
    .map((entry) => {
      const value = entry.theme
        ? JSON.stringify({ title: entry.title, theme: entry.theme })
        : JSON.stringify(entry.title);
      return `  ${JSON.stringify(entry.slug)}: ${value},`;
    })
    .join("\n");
  return `export default {\n${body}\n};\n`;
}

export function localizedHref(href: string, locale: Locale): string {
  if (locale === "ja") return href;
  return href === "/" ? "/en" : `/en${href}`;
}

/** ロケール別の `content/` 配下プレフィックス（`en` は `en/` サブツリー） */
export function localeContentPrefix(locale: Locale): string {
  return locale === "ja" ? "" : "en/";
}

export function seriesTitle(series: SiteSeries, locale: Locale): string {
  return locale === "en" ? (series.nameEn ?? series.name) : series.name;
}

export function courseTitle(course: SiteCourse, locale: Locale): string {
  return locale === "en" ? (course.nameEn ?? course.name) : course.name;
}

export function lessonTitle(lesson: SiteLesson, locale: Locale): string {
  return locale === "en" ? (lesson.titleEn ?? lesson.name) : lesson.name;
}

/** ロケール1つ分の `_meta.js` 一式（ルート・シリーズ・コース） */
export function emitMetaFiles(data: SiteData, locale: Locale): EmittedFile[] {
  const prefix = localeContentPrefix(locale);
  const files: EmittedFile[] = [];

  files.push({
    relativePath: `${prefix}_meta.js`,
    contents: emitMetaFile([
      {
        slug: "index",
        title: locale === "en" ? "Home" : "ホーム",
        // トップは階層の起点なのでパンくずを出さない
        theme: { breadcrumb: false },
      },
      // シリーズトップもパンくずを出さない（1段だけのパンくずに意味が無いため）
      ...data.series.map((series) => ({
        slug: series.slug,
        title: seriesTitle(series, locale),
        theme: { breadcrumb: false },
      })),
    ]),
  });

  // シリーズ・コース階層は「概要」の独立項目を持たない。
  // 概要はフォルダ自身のページ（index の asIndexPage）として開く。
  for (const series of data.series) {
    files.push({
      relativePath: `${prefix}${series.slug}/_meta.js`,
      contents: emitMetaFile(
        series.courses.map((course) => ({
          slug: course.slug,
          title: courseTitle(course, locale),
          // シリーズで切ったパンくずをコース以下で戻す——`theme` は子へ継承されるため
          // （`nextra/dist/client/normalize-pages.js` の pageThemeContext）
          theme: { breadcrumb: true },
        })),
      ),
    });

    for (const course of series.courses) {
      files.push({
        relativePath: `${prefix}${series.slug}/${course.slug}/_meta.js`,
        contents: emitMetaFile(
          course.lessons.map((lesson) => ({
            slug: lesson.slug,
            title: lessonTitle(lesson, locale),
          })),
        ),
      });
    }
  }

  return files;
}

/** ロケール1つ分のトップページ（全体・シリーズ・コース） */
export function emitIndexPages(data: SiteData, locale: Locale): EmittedFile[] {
  const prefix = localeContentPrefix(locale);
  const files: EmittedFile[] = [
    {
      relativePath: `${prefix}index.mdx`,
      contents: emitIndexMdx(
        "home",
        {
          title: "DX Training Mandala",
          description:
            locale === "en" ? data.siteDescriptionEn : data.siteDescription,
        },
        locale,
      ),
    },
  ];

  for (const series of data.series) {
    files.push({
      relativePath: `${prefix}${series.slug}/index.mdx`,
      contents: emitIndexMdx(
        "series",
        {
          title: seriesTitle(series, locale),
          description:
            locale === "en"
              ? (series.descriptionEn ?? series.description)
              : series.description,
          seriesSlug: series.slug,
        },
        locale,
      ),
    });

    for (const course of series.courses) {
      files.push({
        relativePath: `${prefix}${series.slug}/${course.slug}/index.mdx`,
        contents: emitIndexMdx(
          "course",
          {
            title: courseTitle(course, locale),
            description:
              locale === "en"
                ? (course.descriptionEn ?? course.description)
                : course.description,
            seriesSlug: series.slug,
            courseSlug: course.slug,
          },
          locale,
        ),
      });
    }
  }

  return files;
}
