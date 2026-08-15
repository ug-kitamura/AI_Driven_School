"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Layout, Navbar } from "nextra-theme-docs";
import type { PageMapItem } from "nextra";
import siteConfig from "@/site.config.json";
import { LanguageToggle } from "@/components/LanguageToggle";
import { MandalaModal } from "@/components/MandalaModal";
import { localeOf } from "@/lib/locale-path";

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
    {/* テーマは `[projectLink, chatLink, children]` の順に描くので、
        children の先頭に置くと「GitHub → 曼陀羅 → 言語」の並びになる */}
    <MandalaModal />
    <LanguageToggle />
  </Navbar>
);

/**
 * サイドバーには「いま見ている言語のツリーだけ」を出す。
 * 日本語はルートの pageMap から `en` を除き、英語は `en` フォルダの中身を使う
 * （`getPageMap("/en")` と同じもの）。言語の行き来はナビバーのトグルが担う。
 */
function localePageMap(
  pageMap: PageMapItem[],
  pathname: string,
): PageMapItem[] {
  if (localeOf(pathname) === "en") {
    const en = pageMap.find((item) => "name" in item && item.name === "en");
    return en && "children" in en ? en.children : pageMap;
  }
  return pageMap.filter((item) => !("name" in item && item.name === "en"));
}

/**
 * テーマの `<Layout>`（ナビバー・サイドバー）を描く。
 *
 * ⚠ **動的セグメント配下のレイアウトに置いてはならない。**
 * `app/[[...mdxPath]]/layout.tsx` に置くと、クライアント遷移のたびにレイアウトごと
 * 作り直され、next-themes の `<script>` が再マウントされて console エラーを撒く
 * （`Encountered a script tag while rendering React component` と、その巻き添えの
 * `Element type is invalid`）。ルートレイアウトは遷移をまたいで保たれるので、
 * `<Layout>` はそこに置き、「いま見ている言語」は params ではなく
 * `usePathname()` から得る——これがクライアント境界をここに引いている理由。
 */
export function SiteShell({
  pageMap,
  children,
}: {
  pageMap: PageMapItem[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const localizedPageMap = useMemo(
    () => localePageMap(pageMap, pathname),
    [pageMap, pathname],
  );

  return (
    <Layout
      navbar={navbar}
      pageMap={localizedPageMap}
      docsRepositoryBase={siteConfig.repositoryUrl}
      editLink={null}
      feedback={{ content: null }}
    >
      {children}
    </Layout>
  );
}
