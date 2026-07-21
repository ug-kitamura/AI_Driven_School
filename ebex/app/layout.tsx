import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import supergraphicImage from "@/images/supergraphic.png";

// Inter は欧文・数字部分にだけ適用したい（日本語はシステム日本語フォントに任せる）。
// variable で `--font-inter` を発行し、`globals.css` の `--font-sans` で参照する。
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EBEX",
  description:
    "プロジェクトフォルダ内のファイルを入力に AI スキルを発火し、出力を同フォルダに置く 3 ペインワークスペース",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${inter.variable} h-full antialiased`}>
      {/* 高さの正本は body 1 箇所。バナー（固定高）とワークスペース（残り全部）を
          縦に積むことで、バナー高さを変えても中身が追従する。 */}
      <body className="flex h-svh flex-col overflow-hidden">
        {/* 装飾目的の supergraphic バナー。縦帯構成なので cover で中央を切り出しても
            色帯の横並びは保たれる。 */}
        <Image
          src={supergraphicImage}
          alt=""
          aria-hidden
          priority
          className="h-1.5 w-full shrink-0 object-cover"
        />
        {/* shadcn/ui の Sidebar コンポーネント（SidebarMenuButton の collapsed
            時 tooltip 等）が要求するためアプリ全体をラップする。 */}
        <TooltipProvider delay={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
