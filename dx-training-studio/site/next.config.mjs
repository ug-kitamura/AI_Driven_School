import nextra from "nextra";

/** GitHub Pages のサブパス配信で使う。未設定ならルート配信（Vercel / ローカル） */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const withNextra = nextra({});

export default withNextra({
  output: "export",
  // 画像最適化はサーバーが要るため静的 export では使えない
  images: { unoptimized: true },
  // Next.js が AGENTS.md / CLAUDE.md を自動生成するのを止める
  // （プロジェクト側の CLAUDE.md 運用と衝突する）
  agentRules: false,
  ...(basePath ? { basePath } : {}),
});
