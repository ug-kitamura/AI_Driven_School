import { resolveReleaseInfo } from "@/lib/release-info";
import siteConfig from "@/site.config.json";

/** サイト名・リリース番号・出所リポジトリ。全ページの下に出る */
export function SiteFooter() {
  const { release, isRelease, repositoryUrl } = resolveReleaseInfo();

  return (
    <div className="dxm-footer">
      <span>{siteConfig.siteName}</span>
      <span className="dxm-footer-meta">
        <span
          className="dxm-footer-release"
          title={
            isRelease
              ? `リリース ${release} から配信されています`
              : "タグから配信されたビルドではありません"
          }
        >
          {release}
        </span>
        <a href={repositoryUrl} target="_blank" rel="noreferrer noopener">
          GitHub
        </a>
      </span>
    </div>
  );
}
