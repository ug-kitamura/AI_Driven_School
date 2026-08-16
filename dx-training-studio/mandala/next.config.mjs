import nextra from "nextra";
import { rehypeGithubAlerts } from "rehype-github-alerts";

/** GitHub Pages のサブパス配信で使う。未設定ならルート配信（Vercel / ローカル） */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const withNextra = nextra({
  mdxOptions: {
    // `> [!NOTE]` 等の GitHub アラートを Nextra は素で解釈しない（引用に「[!NOTE]」が
    // そのまま出る）。Studio のプレビューと同じプラグインを使い、同じ class 名
    // （`markdown-alert-*`）で出して見た目を揃える。
    //
    // ⚠ このプラグイン指定があるため **dev / build とも `--webpack` が必須**
    // （`package.json` の scripts）。Turbopack はローダーの options を
    // シリアライズ可能な値に限るので、関数であるプラグインを渡すと
    // 「does not have serializable options」で落ちる。unified は文字列での
    // プラグイン指定を受け付けないため、逃げ道は webpack しかない。
    rehypePlugins: [rehypeGithubAlerts],
  },
});

export default withNextra({
  output: "export",
  // 画像最適化はサーバーが要るため静的 export では使えない
  images: { unoptimized: true },
  // Next.js が AGENTS.md / CLAUDE.md を自動生成するのを止める
  // （プロジェクト側の CLAUDE.md 運用と衝突する）
  agentRules: false,
  ...(basePath ? { basePath } : {}),
});
