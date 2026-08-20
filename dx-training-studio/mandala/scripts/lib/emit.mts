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
  // 著者は双方向フォールバック: ja = author → author_en / en = author_en → author
  const author =
    locale === "en"
      ? lesson.authorEn || lesson.author
      : lesson.author || (lesson.authorEn ?? "");

  const frontmatter = [
    "---",
    `title: ${yamlString(title)}`,
    `description: ${yamlString(lesson.description)}`,
    `lessonStatus: ${lesson.status}`,
    `estimatedMinutes: ${lesson.estimatedMinutes}`,
    // ラベル行が使う。コースの受講形態は未設定なら出さない
    ...(author ? [`author: ${yamlString(author)}`] : []),
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
 * `title` に JSX を置きたい項目のための入れ物。
 * Nextra の `_meta` スキーマは `title` に文字列と React 要素の両方を認めている
 * （`nextra/dist/server/schemas.js` の `stringOrElement`）ので、
 * 文字列化せずそのまま式として書き出す。
 */
export type RawExpression = { expression: string };

function isRawExpression(value: unknown): value is RawExpression {
  return typeof value === "object" && value !== null && "expression" in value;
}

/**
 * `_meta` ファイル（slug キー → 表示名。並びはオブジェクトのキー順）。
 *
 * `theme` を持つ項目は Nextra のページ設定オブジェクトとして出す
 * （例: トップページのパンくずを消す）。
 * `title` に `RawExpression` を渡すと JSX として埋め込むので、
 * その場合は呼び出し側が `imports` と `.tsx` の拡張子を用意すること。
 */
export function emitMetaFile(
  entries: Array<{
    slug: string;
    title: string | RawExpression;
    theme?: Record<string, unknown>;
  }>,
  imports: string[] = [],
): string {
  const body = entries
    .map((entry) => {
      // 文字列の title は従来どおり丸ごと JSON にする。式のときだけ組み立てる
      // ——生成物の差分をホーム項目だけに閉じ込めるため
      const value = isRawExpression(entry.title)
        ? entry.theme
          ? `{"title":${entry.title.expression},"theme":${JSON.stringify(entry.theme)}}`
          : entry.title.expression
        : entry.theme
          ? JSON.stringify({ title: entry.title, theme: entry.theme })
          : JSON.stringify(entry.title);
      return `  ${JSON.stringify(entry.slug)}: ${value},`;
    })
    .join("\n");
  const head = imports.length > 0 ? `${imports.join("\n")}\n\n` : "";
  return `${head}export default {\n${body}\n};\n`;
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

  // ルートだけ `.tsx`。ホーム項目のアイコンを JSX で置くため
  // （Nextra の `_meta` は `title` に React 要素を認めている）。
  // 色は lucide の `currentColor` に任せる——リンクの通常・hover・active に自動で乗る。
  // 空白は `.dxm-home-item` の `gap` で取る: サイドバーの `<a>` は flex なので
  // 素の空白文字はフレックスアイテムの先頭で潰れて消える
  const homeLabel = locale === "en" ? "Home" : "ホーム";
  files.push({
    relativePath: `${prefix}_meta.tsx`,
    contents: emitMetaFile(
      [
        {
          slug: "index",
          title: {
            expression: `<span className="dxm-home-item"><House aria-hidden />${homeLabel}</span>`,
          },
          // トップは階層の起点なのでパンくずを出さない
          theme: { breadcrumb: false },
        },
        // シリーズトップもパンくずを出さない（1段だけのパンくずに意味が無いため）
        ...data.series.map((series) => ({
          slug: series.slug,
          title: seriesTitle(series, locale),
          theme: { breadcrumb: false },
        })),
      ],
      [`import { House } from "lucide-react";`],
    ),
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
