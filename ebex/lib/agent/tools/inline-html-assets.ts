/**
 * 生成した HTML を単体で開けるようにする（CDN 依存の除去）。
 *
 * スキルの額縁は Tailwind Play CDN（v3）と Lucide CDN を読み込む前提で書かれている。
 * そのまま配布すると、ネットワークの無い環境や CDN を弾く環境で崩れる。ここでは
 *
 *   1. Tailwind / Lucide の CDN 読み込みと初期化スクリプトを取り除く
 *   2. 対象 HTML の実物をスキャンして Tailwind CSS をその場でコンパイルし差し込む
 *   3. <i data-lucide="X"> を inline <svg> へ展開する
 *
 * を 1 回で行う。事前ビルドしたサブセットは使わない。実物を入力にするため
 * 「用意していないクラスが当たらない」という取りこぼしが原理的に起きない。
 *
 * Tailwind は必ず v3（`tailwindcss-v3` エイリアス）を使う。額縁が読み込む Play CDN が
 * v3 であり、v4 でコンパイルすると shadow の段階名や既定のボーダー色が変わって
 * 既存の成果物と見た目がずれる。EBEX 本体の Tailwind v4 とは別系統。
 */
import { createRequire } from "node:module";

/** 展開できないアイコン名に使う代替 */
const FALLBACK_ICON = "circle-help";

const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const require_ = createRequire(import.meta.url);

export type InlineAssetsReport = {
  /** inline SVG へ展開したアイコンの延べ数 */
  iconsExpanded: number;
  /** 解決できず代替アイコンへ差し替えた名前 */
  iconsFallback: string[];
  /** 差し込んだ CSS のバイト数 */
  cssBytes: number;
};

// --- tailwind.config の抽出 -------------------------------------------------

/**
 * 額縁が `<script>tailwind.config = {...}</script>` で定義する設定を取り出す。
 *
 * 任意のコードは評価しない。データだけからなる部分集合（文字列・数値・真偽値・
 * null・配列・オブジェクト）としてパースし、それ以外の字面が出てきたら諦めて
 * null を返す。設定を取り込めなければ既定のテーマでコンパイルされるだけで、
 * 処理そのものは止めない。
 */
export function extractTailwindConfig(html: string): Record<string, unknown> | null {
  const match = html.match(/tailwind\.config\s*=\s*(\{)/);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length - 1;
  try {
    const { value, end } = parseValue(html, start);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    void end;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function skipWs(src: string, i: number): number {
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }
    // コメントはデータではないので読み飛ばす
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl === -1 ? src.length : nl + 1;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const close = src.indexOf("*/", i);
      if (close === -1) throw new Error("コメントが閉じていません");
      i = close + 2;
      continue;
    }
    break;
  }
  return i;
}

function parseString(src: string, i: number): { value: string; end: number } {
  const quote = src[i];
  let out = "";
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      const next = src[j + 1];
      // 実体が要るのは引用符・バックスラッシュ程度。他はそのまま通す
      out += next === "n" ? "\n" : next === "t" ? "\t" : next;
      j += 2;
      continue;
    }
    if (c === quote) return { value: out, end: j + 1 };
    // テンプレートリテラルの ${} は式なのでデータとして扱わない
    if (quote === "`" && c === "$" && src[j + 1] === "{") {
      throw new Error("テンプレート内の式は扱いません");
    }
    out += c;
    j += 1;
  }
  throw new Error("文字列が閉じていません");
}

function parseValue(src: string, i: number): { value: unknown; end: number } {
  i = skipWs(src, i);
  const c = src[i];
  if (c === undefined) throw new Error("値がありません");

  if (c === '"' || c === "'" || c === "`") return parseString(src, i);

  if (c === "{") {
    const obj: Record<string, unknown> = {};
    let j = skipWs(src, i + 1);
    if (src[j] === "}") return { value: obj, end: j + 1 };
    for (;;) {
      j = skipWs(src, j);
      let key: string;
      if (src[j] === '"' || src[j] === "'" || src[j] === "`") {
        const r = parseString(src, j);
        key = r.value;
        j = r.end;
      } else {
        const m = /^[A-Za-z_$][A-Za-z0-9_$-]*/.exec(src.slice(j));
        if (!m) throw new Error("キーが読めません");
        key = m[0];
        j += m[0].length;
      }
      j = skipWs(src, j);
      if (src[j] !== ":") throw new Error("キーの後に : がありません");
      const r = parseValue(src, j + 1);
      obj[key] = r.value;
      j = skipWs(src, r.end);
      if (src[j] === ",") {
        j = skipWs(src, j + 1);
        if (src[j] === "}") return { value: obj, end: j + 1 };
        continue;
      }
      if (src[j] === "}") return { value: obj, end: j + 1 };
      throw new Error("オブジェクトの区切りが読めません");
    }
  }

  if (c === "[") {
    const arr: unknown[] = [];
    let j = skipWs(src, i + 1);
    if (src[j] === "]") return { value: arr, end: j + 1 };
    for (;;) {
      const r = parseValue(src, j);
      arr.push(r.value);
      j = skipWs(src, r.end);
      if (src[j] === ",") {
        j = skipWs(src, j + 1);
        if (src[j] === "]") return { value: arr, end: j + 1 };
        continue;
      }
      if (src[j] === "]") return { value: arr, end: j + 1 };
      throw new Error("配列の区切りが読めません");
    }
  }

  const literal = /^(true|false|null)\b/.exec(src.slice(i));
  if (literal) {
    const v = literal[1] === "true" ? true : literal[1] === "false" ? false : null;
    return { value: v, end: i + literal[1].length };
  }

  const num = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
  if (num) return { value: Number(num[0]), end: i + num[0].length };

  // 識別子・関数呼び出し・演算子などはデータではない
  throw new Error(`データとして扱えない字面: ${src.slice(i, i + 20)}`);
}

// --- CDN の除去 -------------------------------------------------------------

/**
 * CDN の読み込み・tailwind.config・createIcons 呼び出しを取り除く。
 *
 * web フォントの `<link>` は**残す**。スタイルとアイコンは埋め込むので描画は
 * オフラインでも成立し、フォントは額縁の `font-family` に並ぶローカルフォントへ
 * 倒れる（実測では字形が変わるだけでレイアウトは保たれる）。埋め込むと日本語
 * フォントはサブセット化しても数百 KB〜MB 級になり、インライン化で抑えた
 * サイズの意味が消えるため取らない。
 */
export function stripCdn(html: string): string {
  return html
    .replace(/[ \t]*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\r?\n?/g, "")
    .replace(/[ \t]*<script src="https:\/\/unpkg\.com\/lucide@[^"]*"><\/script>\r?\n?/g, "")
    .replace(/[ \t]*<script>\s*tailwind\.config\s*=[\s\S]*?<\/script>\r?\n?/g, "")
    .replace(/[ \t]*<script>\s*lucide\.createIcons\(\);?\s*<\/script>\r?\n?/g, "");
}

// --- アイコンの展開 ---------------------------------------------------------

function toPascalCase(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Lucide のパスデータを取り出す。
 *
 * ホスト側の `lucide-react` から解決する（スキルへは同梱しない）。旧名は新名への
 * 再エクスポートになっているため（`circle-help` → `circle-question-mark` 等）、
 * 実体をレンダリングして中身を取ることで自動的に辿られる。
 */
function resolveIconInner(name: string): string | null {
  try {
    const icons = require_("lucide-react") as Record<string, unknown>;
    const component = icons[toPascalCase(name)];
    if (!component) return null;
    const React = require_("react") as typeof import("react");
    const { renderToStaticMarkup } = require_(
      "react-dom/server",
    ) as typeof import("react-dom/server");
    const markup = renderToStaticMarkup(
      React.createElement(component as React.ElementType),
    );
    const inner = markup.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
    return inner ? inner[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * `<i data-lucide="X" class="..." style="...">` を inline `<svg>` へ置き換える。
 * 元の class / style を引き継がないと、既定サイズ（24px）で巨大化する。
 */
export function expandIcons(
  html: string,
  resolve: (name: string) => string | null = resolveIconInner,
): { html: string; expanded: number; fallback: string[] } {
  const cache = new Map<string, string | null>();
  const fallback = new Set<string>();
  let expanded = 0;

  const lookup = (name: string): string | null => {
    if (!cache.has(name)) cache.set(name, resolve(name));
    return cache.get(name) ?? null;
  };

  const out = html.replace(
    /<i\b([^>]*?)data-lucide="([a-z0-9-]+)"([^>]*?)>\s*<\/i>/g,
    (whole, before: string, name: string, after: string) => {
      let inner = lookup(name);
      if (!inner) {
        inner = lookup(FALLBACK_ICON);
        if (!inner) return whole;
        fallback.add(name);
      }
      const attrs = `${before} ${after}`.replace(/\s+/g, " ").trim();
      expanded += 1;
      return `${SVG_OPEN}${attrs ? ` ${attrs}` : ""}>${inner}</svg>`;
    },
  );

  return { html: out, expanded, fallback: [...fallback].sort() };
}

// --- CSS のコンパイル -------------------------------------------------------

/**
 * 対象 HTML の実物をスキャンして Tailwind CSS を生成する。
 * `content` に raw を渡すので一時ファイルは要らない。
 */
export async function compileCss(
  html: string,
  extend: Record<string, unknown> | null,
): Promise<string> {
  // CJS 実体は呼び出し可能な関数だが、型定義側は名前空間として解決されるため
  // 呼び出しシグネチャを明示する
  const postcss = require_("postcss") as unknown as (
    plugins: import("postcss").AcceptedPlugin[],
  ) => import("postcss").Processor;
  const tailwind = require_("tailwindcss-v3") as (config: unknown) => unknown;

  const theme = (extend?.theme ?? {}) as Record<string, unknown>;
  const config = {
    content: [{ raw: html, extension: "html" }],
    theme,
  };

  const result = await postcss([
    tailwind(config) as import("postcss").AcceptedPlugin,
  ]).process("@tailwind base;@tailwind components;@tailwind utilities;", {
    from: undefined,
  });
  return result.css;
}

// --- 差し込み ---------------------------------------------------------------

/**
 * 生成した CSS を文書の**最初の** `<head>` へ入れる。
 * 区間へ完結した HTML 文書が差し込まれていると `<head>` が複数ありうるため、
 * 最後の `</head>` を狙うと `<main>` の内側へ入ってしまう。
 */
export function injectStyle(html: string, css: string): string {
  const style = `<style data-inlined-tailwind>\n${css}\n</style>\n`;
  const close = html.indexOf("</head>");
  if (close !== -1) return html.slice(0, close) + style + html.slice(close);

  const openTag = html.match(/<html[^>]*>/i);
  if (openTag && openTag.index !== undefined) {
    const at = openTag.index + openTag[0].length;
    return `${html.slice(0, at)}\n<head>\n${style}</head>${html.slice(at)}`;
  }
  return style + html;
}

// --- 入口 -------------------------------------------------------------------

export async function inlineHtmlAssets(
  html: string,
): Promise<{ html: string; report: InlineAssetsReport }> {
  const extend = extractTailwindConfig(html);

  let out = stripCdn(html);
  const icons = expandIcons(out);
  out = icons.html;

  const css = await compileCss(out, extend);
  out = injectStyle(out, css);

  return {
    html: out,
    report: {
      iconsExpanded: icons.expanded,
      iconsFallback: icons.fallback,
      cssBytes: Buffer.byteLength(css, "utf8"),
    },
  };
}
