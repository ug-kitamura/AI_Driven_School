import type { ReactNode } from "react";
import Image from "next/image";
import { Head } from "nextra/components";
import siteConfig from "@/site.config.json";
import supergraphicImage from "./supergraphic.png";
import "nextra-theme-docs/style.css";
import "./globals.css";

export const metadata = {
  title: {
    default: siteConfig.siteName,
    template: `%s | ${siteConfig.siteName}`,
  },
  description:
    "DX ツールを業務で使えるようになるためのトレーニング。曼陀羅で全体の道のりを見渡しながら進められます。",
};

/**
 * テーマの `<Layout>`（ナビバー・サイドバー・フッター）は
 * `app/[[...mdxPath]]/layout.tsx` 側に置く——サイドバーを言語ごとに出し分けるため、
 * ルートパスを見られる場所で pageMap を組み立てる必要がある。
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        {/* 装飾目的の supergraphic バナー。縦帯構成なので cover で中央を切り出しても
            色帯の横並びは保たれる。テーマの sticky ナビより外側に置くため、
            スクロールすると画面外へ流れる（ページ最上部の装飾という位置づけ）。 */}
        <Image
          src={supergraphicImage}
          alt=""
          aria-hidden
          priority
          className="dxm-supergraphic"
        />
        {children}
      </body>
    </html>
  );
}
