import type { NextConfig } from "next";
import path from "node:path";

// プロジェクトルートを明示する。次の事故を防ぐ目的:
//   1. 親ディレクトリ（ホーム直下など）に lockfile が紛れていると Next.js が
//      そこをワークスペースルートと誤認識し、`outputFileTracing` が想定外の範囲を辿る
//   2. モノレポ内でも本ディレクトリを tracing の基準にする
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  // tailwindcss-v3 は設定解決・プラグイン読み込みで動的 require を使うため、
  // サーバーバンドルへ取り込ませず Node の require に任せる。
  serverExternalPackages: ["playwright", "tailwindcss-v3", "postcss"],
};

export default nextConfig;
