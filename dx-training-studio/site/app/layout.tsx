import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import siteConfig from "@/site.config.json";
import { SiteShell } from "@/components/SiteShell";
import { resolveReleaseInfo } from "@/lib/release-info";
import supergraphicImage from "./supergraphic.png";
import "nextra-theme-docs/style.css";
import "./globals.css";

export const metadata = {
  // 全ページ共通でサイト名のみを表示する（ページ別の title は使わない）。
  // 実際の上書きは app/[[...mdxPath]]/page.jsx の generateMetadata が担う。
  title: siteConfig.siteName,
  description:
    "DX ツールを業務で使えるようになるためのトレーニング。曼陀羅で全体の道のりを見渡しながら進められます。",
};

/**
 * テーマの `<Layout>` は `SiteShell` が描く。
 *
 * ⚠ `SiteShell` を動的セグメント配下のレイアウトへ移さないこと——
 * クライアント遷移のたびに作り直され、console エラーの原因になる（理由は SiteShell 参照）。
 * pageMap は言語を問わないルート全体を1回だけ組み立て、言語による絞り込みは
 * `SiteShell` がパスから行う。
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { release } = resolveReleaseInfo();

  return (
    <html lang="ja" dir="ltr" suppressHydrationWarning>
      <Head />
      {/* リリース番号はサイドバー最上部に `::before` で描く（テーマに差し込み口が無いため）。
          タグ由来でないビルドでは変数を置かない——`content` が無効になり、
          擬似要素そのものが生成されないので、行も余白も残らない。 */}
      <body
        style={
          release
            ? ({ "--dxm-release": JSON.stringify(release) } as CSSProperties)
            : undefined
        }
      >
        {/* 装飾目的の supergraphic バナー。縦帯構成なので cover で中央を切り出しても
            色帯の横並びは保たれる。スクロール中も画面最上部に留まる——
            固定は `globals.css` 側の `position: fixed` が担う。帯はフローから外れ、
            その 6px はテーマの `--nextra-navbar-height` を 1 本増やして navbar 側に
            確保している。`sticky` にすると帯がフローに 6px 残り、navbar がその分
            ずり上がってから固定される（詳細は `.dxm-supergraphic` のコメント）。 */}
        <Image
          src={supergraphicImage}
          alt=""
          aria-hidden
          priority
          className="dxm-supergraphic"
        />
        <SiteShell pageMap={await getPageMap()}>{children}</SiteShell>
      </body>
    </html>
  );
}
