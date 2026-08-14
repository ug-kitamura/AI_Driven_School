import type { ReactNode } from "react";
import { Layout, Navbar, Footer } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import siteConfig from "@/site.config.json";
import { LanguageToggle } from "@/components/LanguageToggle";
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

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ja" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase={siteConfig.repositoryUrl}
          editLink={null}
          feedback={{ content: null }}
          footer={<Footer>{siteConfig.siteName}</Footer>}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
