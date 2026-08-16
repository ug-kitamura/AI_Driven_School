// ⚠ 空だが必要なファイル。消すと CI が落ちる。
//
// site は Tailwind を使わない（app/globals.css に @import "tailwindcss" /
// @tailwind / @apply は 1 つも無く、Nextra と @xyflow の CSS はビルド済み）。
// それでもこの設定が要るのは、Next の postcss 設定探索が find-up で親方向へ
// 遡るため（next/dist/lib/find-config.js の findConfigPath）。site に設定が
// 無いと親の dx-training-studio/postcss.config.mjs（@tailwindcss/postcss）が
// 拾われてしまう。
//
// ローカルは親の node_modules に解決できるので通るが、CI は site/ でしか
// npm ci しないため「Cannot find module '@tailwindcss/postcss'」で落ちる。
// 空の設定を置くと探索が site/ で止まり、親の設定にも親の node_modules にも
// 依存しなくなる。
const config = {
  plugins: {},
};

export default config;
