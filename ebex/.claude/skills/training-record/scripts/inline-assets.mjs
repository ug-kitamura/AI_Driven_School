/**
 * 生成した HTML を単体で開けるようにする（CDN 依存の除去）。
 *
 *   node scripts/inline-assets.mjs <HTMLのパス> [<HTMLのパス> ...]
 *
 * やること:
 *   1. Tailwind / Lucide の CDN 読み込みと lucide.createIcons() を取り除く
 *   2. assets/subset.css を <style> として差し込む
 *   3. <i data-lucide="X"> を inline <svg> へ展開する（class / style は引き継ぐ）
 *   4. 同梱していないアイコンは取得を試み、失敗したら代替アイコンへ差し替える
 *   5. 取得・代替・未収録クラスの件数を報告する
 *
 * 取得したアイコンは作業フォルダ直下の _work/icons/ へ置く（スキルフォルダは書込不可）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_DIR = path.join(SKILL_DIR, "assets");
const FALLBACK_ICON = "circle-help";
const ICON_CDN = "https://unpkg.com/lucide-static@latest/icons";
const FETCH_TIMEOUT_MS = 8000;

const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

function readIcons() {
  const file = path.join(ASSETS_DIR, "icons.json");
  if (!fs.existsSync(file)) {
    throw new Error(`assets/icons.json がありません: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readSubsetCss() {
  const file = path.join(ASSETS_DIR, "subset.css");
  if (!fs.existsSync(file)) {
    throw new Error(`assets/subset.css がありません: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

/** 作業フォルダ直下の _work/icons/ に落とした取得済みアイコンを読む */
function readCachedIcon(cacheDir, name) {
  const file = path.join(cacheDir, `${name}.svg`);
  if (!fs.existsSync(file)) return null;
  return extractSvgInner(fs.readFileSync(file, "utf8"));
}

function extractSvgInner(svgText) {
  const match = svgText.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  return match ? match[1].trim() : null;
}

async function fetchIcon(name, cacheDir) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${ICON_CDN}/${name}.svg`, { signal: controller.signal });
    if (!res.ok) return null;
    const text = await res.text();
    const inner = extractSvgInner(text);
    if (!inner) return null;
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, `${name}.svg`), text, "utf8");
    return inner;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** CDN の読み込みと createIcons 呼び出しを取り除く */
function stripCdn(html) {
  return html
    .replace(/[ \t]*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\r?\n?/g, "")
    .replace(/[ \t]*<script src="https:\/\/unpkg\.com\/lucide@[^"]*"><\/script>\r?\n?/g, "")
    .replace(/[ \t]*<script>\s*tailwind\.config\s*=[\s\S]*?<\/script>\r?\n?/g, "")
    .replace(/[ \t]*<script>\s*lucide\.createIcons\(\);?\s*<\/script>\r?\n?/g, "");
}

/** subset.css を最後の </head> の直前へ入れる */
function injectCss(html, css) {
  if (html.includes("data-inlined-subset")) return html;
  const style = `<style data-inlined-subset>\n${css}\n</style>\n`;
  const index = html.lastIndexOf("</head>");
  if (index === -1) return style + html;
  return html.slice(0, index) + style + html.slice(index);
}

function collectIconNames(html) {
  return [...new Set([...html.matchAll(/data-lucide="([a-z0-9-]+)"/g)].map((m) => m[1]))];
}

/** <i data-lucide="X" ...></i> を <svg ...>…</svg> へ置き換える */
function expandIcons(html, resolve) {
  return html.replace(
    /<i\b([^>]*?)data-lucide="([a-z0-9-]+)"([^>]*?)>\s*<\/i>/g,
    (whole, before, name, after) => {
      const inner = resolve(name);
      if (!inner) return whole;
      const attrs = `${before} ${after}`
        .replace(/\s+/g, " ")
        .trim();
      return `${SVG_OPEN}${attrs ? ` ${attrs}` : ""}>${inner}</svg>`;
    },
  );
}

/**
 * どのスタイルにも定義が無いクラスを拾う。
 * 額縁自身の <style>（section-card 等のカスタムクラス）も照合対象に含める。
 * 含めないと、Tailwind 由来でないクラスがすべて未収録として報告される。
 */
function findMissingClasses(html, css) {
  const used = new Set();
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    for (const cls of m[1].split(/\s+/)) {
      if (cls) used.add(cls);
    }
  }
  const ownStyles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])
    .join("\n");
  // セレクタ内のエスケープ（.md\:flex 等）を外してから含有判定する
  const haystack = `${css}\n${ownStyles}`.replace(/\\/g, "");
  return [...used].filter((cls) => !haystack.includes(`.${cls}`)).sort();
}

async function processFile(target, icons, css) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) throw new Error(`ファイルがありません: ${abs}`);
  // 取得したアイコンは作業フォルダ直下の _work/icons/ へ置く。
  // 成果物の位置から `..` で辿ると、成果物が作業フォルダ直下にある場合に
  // 作業フォルダの外へ出てしまうため、ホストが渡す作業フォルダを基準にする。
  const workDir = process.env.EBEX_PROJECT_DIR ?? path.dirname(abs);
  const cacheDir = path.join(workDir, "_work", "icons");

  let html = fs.readFileSync(abs, "utf8");
  const names = collectIconNames(html);

  const resolved = new Map();
  const fetched = [];
  const replaced = [];
  for (const name of names) {
    if (icons[name]) {
      resolved.set(name, icons[name]);
      continue;
    }
    const cached = readCachedIcon(cacheDir, name);
    if (cached) {
      resolved.set(name, cached);
      continue;
    }
    const downloaded = await fetchIcon(name, cacheDir);
    if (downloaded) {
      resolved.set(name, downloaded);
      fetched.push(name);
      continue;
    }
    resolved.set(name, icons[FALLBACK_ICON] ?? null);
    replaced.push(name);
  }

  html = stripCdn(html);
  html = expandIcons(html, (name) => resolved.get(name));
  html = injectCss(html, css);
  const missingClasses = findMissingClasses(html, css);

  fs.writeFileSync(abs, html, "utf8");
  return { abs, iconCount: names.length, fetched, replaced, missingClasses };
}

async function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("使い方: node scripts/inline-assets.mjs <HTMLのパス> [...]");
    process.exit(1);
  }
  const icons = readIcons();
  const css = readSubsetCss();

  for (const target of targets) {
    const r = await processFile(target, icons, css);
    console.log(`[${path.basename(r.abs)}]`);
    console.log(`  アイコン ${r.iconCount} 種類を展開`);
    if (r.fetched.length) console.log(`  取得 ${r.fetched.length} 件: ${r.fetched.join(", ")}`);
    if (r.replaced.length)
      console.log(
        `  代替へ差し替え ${r.replaced.length} 件（取得できず）: ${r.replaced.join(", ")}`,
      );
    if (r.missingClasses.length)
      console.log(
        `  未収録クラス ${r.missingClasses.length} 件: ${r.missingClasses.join(", ")}`,
      );
    if (!r.fetched.length && !r.replaced.length && !r.missingClasses.length)
      console.log("  取得・代替・未収録なし");
  }
}

await main();
