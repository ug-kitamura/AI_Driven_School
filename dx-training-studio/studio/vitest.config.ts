import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
  resolve: {
    // ⚠ 配列で順序を明示する。より限定的な別名を `@` より先に置かないと、
    // プレフィックス一致で `@` の側に食われる
    alias: [
      {
        // ラベル語彙の parity テストが mandala の `lib/site-data.ts` を読むための差し替え。
        // 当該モジュールはビルド生成物の JSON を import するが、語彙の整形関数は
        // その中身を使わないのでスタブで足りる（生成物は git 管理外なので実体に頼らない）。
        // ⚠ **テスト専用**。アプリの実行時に mandala へ依存してはならない
        // （studio-translation spec / mandala の独立性は CI が検証する）
        find: "@/content/site-data.json",
        replacement: path.resolve(__dirname, "__tests__/fixtures/site-data-stub.json"),
      },
      { find: "@", replacement: path.resolve(__dirname, ".") },
    ],
  },
});
