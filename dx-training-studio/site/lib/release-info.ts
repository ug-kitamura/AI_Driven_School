import siteConfig from "@/site.config.json";

/** タグから作られていないビルド（ローカル・CI）の表示 */
export const DEV_RELEASE = "dev";

export type ReleaseInfo = {
  /** リリース番号（タグ名）。タグ由来でなければ `dev` */
  release: string;
  /** タグから配信されたビルドか */
  isRelease: boolean;
  repositoryUrl: string;
};

/**
 * ビルド時に注入されたリリース情報を返す。
 *
 * リリースワークフローが `NEXT_PUBLIC_SITE_RELEASE` にタグ名を入れる。
 * 静的 export でもクライアントから読めるよう `NEXT_PUBLIC_` 接頭辞を使う。
 */
export function resolveReleaseInfo(
  rawRelease: string | undefined = process.env.NEXT_PUBLIC_SITE_RELEASE,
): ReleaseInfo {
  const trimmed = rawRelease?.trim();
  const hasRelease = Boolean(trimmed);
  return {
    release: hasRelease ? trimmed! : DEV_RELEASE,
    isRelease: hasRelease,
    repositoryUrl: siteConfig.repositoryUrl,
  };
}
