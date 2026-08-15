/**
 * Studio の `@/...` エイリアス（tsconfig paths）を Node の解決に教えるフック。
 * parity テストが Studio のローダーを素の Node で実行するために使う。
 */
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const studioRoot = process.env.STUDIO_ROOT;

export async function resolve(specifier, context, next) {
  if (!studioRoot || !specifier.startsWith("@/")) {
    return next(specifier, context);
  }
  const base = path.join(studioRoot, specifier.slice(2));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
  ];
  const found = candidates.find(
    (c) => fs.existsSync(c) && fs.statSync(c).isFile(),
  );
  return next(pathToFileURL(found ?? base).href, context);
}
