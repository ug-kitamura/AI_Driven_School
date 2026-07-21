import fs from "node:fs";
import path from "node:path";

/** ホストリポのルートに置くマーカー。中身は問わず、存在だけを見る。 */
export const HOST_MARKER_FILENAME = ".ebex.host";

/** 解決済みの projectRoot。解決時の cwd をキーにして取り違えを防ぐ。 */
let cache: { cwd: string; projectRoot: string } | null = null;

/**
 * projectRoot = ユーザーの作業データの基準ルート。
 * `workspace/` / `workspace/.meta/` / ホスト側スキルカタログはここを基準に解決する。
 *
 * appRoot（ebex の設置ディレクトリ）とは別概念であり、製品同梱物
 * （`contracts/` / ebex 側 `.claude/skills` / `images/`）は
 * `getEbexRoot()`（`lib/agent/skill-loader.ts`）を基準にすること。
 *
 * 解決規則: `process.cwd()` の**親 1 階層のみ**を見て `.ebex.host` があれば親、
 * なければ `process.cwd()` 自身。祖先へは遡らない。環境変数では変えられない。
 * 解決結果はキャッシュし、同じ cwd で 2 回目以降は fs を触らない。
 * 実行中に cwd が変わるのはテストだけなので、キャッシュは cwd をキーにする。
 */
export function getProjectRoot(): string {
  const cwd = path.resolve(process.cwd());
  if (cache?.cwd === cwd) return cache.projectRoot;
  cache = { cwd, projectRoot: resolveProjectRoot(cwd) };
  return cache.projectRoot;
}

function resolveProjectRoot(cwd: string): string {
  const parent = path.dirname(cwd);
  // path.dirname はルート（"C:\\" 等）で自分自身を返す。そこに親はない。
  if (parent === cwd) return cwd;
  return isFile(path.join(parent, HOST_MARKER_FILENAME)) ? parent : cwd;
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}
