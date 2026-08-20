import { siteChrome } from "@/lib/site-data";

export type ReleaseInfo = {
  /** リリース番号（タグ名）。タグ由来のビルドでなければ undefined */
  release?: string;
  /** タグから配信されたビルドか */
  isRelease: boolean;
  repositoryUrl: string;
};

/**
 * ビルド時に注入されたリリース情報を返す。
 *
 * リリースワークフローが `NEXT_PUBLIC_SITE_RELEASE` にタグ名を入れる。
 * 静的 export でもクライアントから読めるよう `NEXT_PUBLIC_` 接頭辞を使う。
 *
 * タグ由来でないビルド（ローカル・CI）は `release` を持たない——
 * `dev` のような代替文字列を出さず、表示側は何も描かない。
 */
export function resolveReleaseInfo(
  rawRelease: string | undefined = process.env.NEXT_PUBLIC_SITE_RELEASE,
): ReleaseInfo {
  const trimmed = rawRelease?.trim();
  return {
    release: trimmed || undefined,
    isRelease: Boolean(trimmed),
    repositoryUrl: siteChrome().githubUrl,
  };
}
