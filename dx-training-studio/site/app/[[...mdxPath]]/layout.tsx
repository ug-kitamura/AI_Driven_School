import type { ReactNode } from "react";
import { Layout, Navbar, Footer } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import siteConfig from "@/site.config.json";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SiteFooter } from "@/components/SiteFooter";

const navbar = (
  <Navbar
    logo={
      <span className="dxm-logo">
        <span className="dxm-logo-mark" aria-hidden="true" />
        {siteConfig.siteName}
      </span>
    }
    projectLink={siteConfig.repositoryUrl}
  >
    <LanguageToggle />
  </Navbar>
);

/**
 * サイドバーには「いま見ている言語のツリーだけ」を出す。
 * 日本語はルートの pageMap から `en` を除き、英語は `/en` のサブツリーを使う。
 * 言語の行き来はナビバーのトグルが担う。
 */
async function localePageMap(mdxPath: string[] | undefined) {
  const isEnglish = mdxPath?.[0] === "en";
  if (isEnglish) return getPageMap("/en");

  const pageMap = await getPageMap();
  return pageMap.filter(
    (item) => !("name" in item && item.name === "en"),
  );
}

export default async function MdxLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ mdxPath?: string[] }>;
}) {
  const { mdxPath } = await params;

  return (
    <Layout
      navbar={navbar}
      pageMap={await localePageMap(mdxPath)}
      docsRepositoryBase={siteConfig.repositoryUrl}
      editLink={null}
      feedback={{ content: null }}
      footer={
        <Footer>
          <SiteFooter />
        </Footer>
      }
    >
      {children}
    </Layout>
  );
}
