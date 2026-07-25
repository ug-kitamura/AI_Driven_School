/**
 * スキル同梱アセット（Tailwind サブセット CSS / Lucide アイコン）を生成する開発用スクリプト。
 *
 *   npm run build:skill-assets
 *
 * 実行時（EBEX 上）は npm / npx を使えないため、npx が要る工程をここへ寄せている。
 * スキルの scripts/ には置かない。置くと run_skill_script の対象になり、
 * モデルが誤って実行してしまう。
 *
 * Tailwind は **v3 で固定**する。スキルの額縁が読み込む CDN
 * （https://cdn.tailwindcss.com）が v3 の Play CDN であり、
 * v4 でビルドすると shadow-* の段階名やデフォルトのボーダー色が変わって
 * 既存の成果物と見た目がずれるため。EBEX 本体の Tailwind v4 とは無関係。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAILWIND_VERSION = "tailwindcss@3.4.17";
const APP_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SKILLS_DIR = path.join(APP_ROOT, ".claude", "skills");
const LUCIDE_ICONS_DIR = path.join(
  APP_ROOT,
  "node_modules",
  "lucide-react",
  "dist",
  "esm",
  "icons",
);

/** アセットを持たせるスキル */
const TARGET_SKILLS = [
  "meeting-minutes",
  "meeting-minutes-ebe",
  "training-record",
  "visual-explainer",
];

/** 語彙の入力にする同梱ファイル（存在するものだけ使う） */
const VOCABULARY_FILES = [
  "references/base.html",
  "references/model-answer.html",
];

/**
 * 実測語彙に上乗せする汎用アイコン。
 * 模範回答に無い名前をモデルが選んでも、取得へ回らず済む分を増やす。
 */
const COMMON_ICONS = [
  "activity",
  "alert-circle",
  "alert-triangle",
  "arrow-down",
  "arrow-left",
  "arrow-right",
  "arrow-up",
  "award",
  "bar-chart",
  "bell",
  "book",
  "book-open",
  "bookmark",
  "briefcase",
  "bug",
  "calendar",
  "check",
  "check-circle",
  "chevron-down",
  "chevron-right",
  "circle",
  "circle-help",
  "clipboard",
  "clipboard-check",
  "clock",
  "cloud",
  "code",
  "compass",
  "cpu",
  "database",
  "download",
  "external-link",
  "eye",
  "file",
  "file-check",
  "file-text",
  "filter",
  "flag",
  "folder",
  "gauge",
  "gift",
  "git-branch",
  "globe",
  "graduation-cap",
  "grid",
  "hand",
  "hash",
  "heart",
  "home",
  "image",
  "inbox",
  "info",
  "key",
  "layers",
  "layout",
  "lightbulb",
  "link",
  "list",
  "list-checks",
  "lock",
  "mail",
  "map",
  "map-pin",
  "megaphone",
  "message-circle",
  "message-square",
  "mic",
  "minus",
  "monitor",
  "moon",
  "network",
  "package",
  "pen",
  "phone",
  "pie-chart",
  "play",
  "plus",
  "presentation",
  "puzzle",
  "refresh-cw",
  "repeat",
  "rocket",
  "search",
  "send",
  "server",
  "settings",
  "share",
  "shield",
  "shuffle",
  "sparkles",
  "star",
  "sun",
  "table",
  "tag",
  "target",
  "terminal",
  "thumbs-up",
  "timer",
  "trending-down",
  "trending-up",
  "triangle-alert",
  "trophy",
  "truck",
  "upload",
  "user",
  "user-check",
  "users",
  "video",
  "wallet",
  "wand",
  "workflow",
  "wrench",
  "zap",
];

/** 取得も失敗したときの差し替え先。必ず同梱する */
const FALLBACK_ICON = "circle-help";

/**
 * 実測語彙の外側を埋める safelist。
 * 未収録クラスの報告が増えたらここへ足して再生成する。
 */
const SAFELIST_PATTERNS = [
  // 色（テンプレートで実際に出る系統に絞る。グラデーションは禁止なので含めない）
  "^(bg|text|border)-(slate|gray|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|pink|rose)-(50|100|200|300|400|500|600|700|800|900)$",
  // 余白
  "^-?(m|mt|mr|mb|ml|mx|my|p|pt|pr|pb|pl|px|py)-(0|0\\.5|1|1\\.5|2|2\\.5|3|3\\.5|4|5|6|7|8|9|10|11|12|14|16|20|24)$",
  // 寸法
  "^(w|h|min-w|min-h|max-w|size)-(0|1|2|3|4|5|6|7|8|9|10|11|12|14|16|20|24|32|40|48|56|64|full|screen|fit|min|max|auto|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)$",
  // タイポグラフィ
  "^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$",
  "^font-(thin|light|normal|medium|semibold|bold|extrabold|black)$",
  "^leading-(none|tight|snug|normal|relaxed|loose|3|4|5|6|7|8|9|10)$",
  "^tracking-(tighter|tight|normal|wide|wider|widest)$",
  "^text-(left|center|right|justify)$",
  // レイアウト
  "^(grid-cols|grid-rows|col-span|row-span|gap|gap-x|gap-y)-(1|2|3|4|5|6|7|8|9|10|11|12)$",
  "^(flex|inline-flex|grid|inline-grid|block|inline-block|inline|hidden|table)$",
  "^(flex-row|flex-col|flex-wrap|flex-nowrap|flex-1|flex-auto|flex-none|flex-shrink-0|flex-grow)$",
  "^(items|justify|self|content)-(start|end|center|between|around|evenly|stretch|baseline)$",
  "^(absolute|relative|fixed|sticky|static)$",
  "^(top|right|bottom|left|inset)-(0|1|2|3|4|5|6|8|10|12|auto|full)$",
  "^z-(0|10|20|30|40|50|auto)$",
  // 装飾
  "^rounded(-(sm|md|lg|xl|2xl|3xl|full|none))?$",
  "^rounded-(t|r|b|l|tl|tr|br|bl)(-(sm|md|lg|xl|2xl|3xl|full|none))?$",
  "^border(-(0|2|4|8|t|r|b|l|t-2|r-2|b-2|l-2))?$",
  "^shadow(-(sm|md|lg|xl|2xl|inner|none))?$",
  "^opacity-(0|5|10|20|25|30|40|50|60|70|75|80|90|95|100)$",
  "^(overflow|overflow-x|overflow-y)-(auto|hidden|visible|scroll)$",
  "^(whitespace|break)-(normal|nowrap|pre|pre-line|pre-wrap|words|all)$",
  "^(object|list)-(contain|cover|fill|none|disc|decimal|inside|outside)$",
  "^(uppercase|lowercase|capitalize|normal-case|italic|not-italic|underline|line-through|no-underline|truncate)$",
  "^(mx|my)-auto$",
];

/**
 * safelist へ付けるバリアント。
 * 額縁・模範回答に実在する `md:` 等は content スキャンが拾うため、ここは絞る。
 * 増やすと safelist 全体がその数だけ倍化して CSS が一気に膨らむ。
 */
const SAFELIST_VARIANTS = [];

function log(...args) {
  console.log(...args);
}

/** base.html / model-answer.html から data-lucide の名前を集める */
function collectIconNames(skillDir) {
  const names = new Set();
  for (const rel of VOCABULARY_FILES) {
    const file = path.join(skillDir, rel);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    for (const m of html.matchAll(/data-lucide="([a-z0-9-]+)"/g)) {
      names.add(m[1]);
    }
  }
  for (const name of COMMON_ICONS) names.add(name);
  names.add(FALLBACK_ICON);
  return [...names].sort();
}

/**
 * lucide-react の icon モジュールから内側のノード定義を取り出し、
 * SVG 断片（<path .../> など）の文字列へ組み立てる。
 */
function buildIconMarkup(name, seen = new Set()) {
  const file = path.join(LUCIDE_ICONS_DIR, `${name}.mjs`);
  if (!fs.existsSync(file) || seen.has(name)) return null;
  seen.add(name);
  const src = fs.readFileSync(file, "utf8");
  // 旧名は新名への再エクスポートになっているので辿る（例: circle-help → circle-question-mark）
  const alias = src.match(/export \{ default \} from '\.\/([a-z0-9-]+)\.mjs';/);
  if (alias) return buildIconMarkup(alias[1], seen);
  const match = src.match(/const __iconNode = (\[[\s\S]*?\]);/);
  if (!match) return null;
  // キーが引用符なしの JS オブジェクトリテラルなので JSON.parse では読めない
  /** @type {Array<[string, Record<string, string>]>} */
  const nodes = new Function(`return ${match[1]};`)();
  return nodes
    .map(([tag, attrs]) => {
      const rendered = Object.entries(attrs)
        .filter(([key]) => key !== "key")
        .map(([key, value]) => `${key}="${value}"`)
        .join(" ");
      return `<${tag} ${rendered}/>`;
    })
    .join("");
}

function writeIconsJson(skillDir, names) {
  const icons = {};
  const missing = [];
  for (const name of names) {
    const markup = buildIconMarkup(name);
    if (markup) icons[name] = markup;
    else missing.push(name);
  }
  const outPath = path.join(skillDir, "assets", "icons.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(icons, null, 0), "utf8");
  return {
    count: Object.keys(icons).length,
    missing,
    bytes: fs.statSync(outPath).size,
  };
}

/**
 * 額縁にインラインで書かれた `tailwind.config = {...}` をそのまま取り出す。
 * ビルド側へ書き写すとドリフトするため、額縁を正本にする。
 */
function extractTailwindConfig(skillDir) {
  const file = path.join(skillDir, "references", "base.html");
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, "utf8");
  const match = html.match(
    /tailwind\.config\s*=\s*(\{[\s\S]*?\n\s*\})\s*<\/script>/,
  );
  if (!match) return null;
  const tailwind = {};
  new Function("tailwind", `tailwind.config = ${match[1]};`)(tailwind);
  return tailwind.config;
}

function buildSafelist() {
  return SAFELIST_PATTERNS.map((pattern) => ({
    pattern,
    variants: SAFELIST_VARIANTS,
  }));
}

function buildSubsetCss(skillId, skillDir) {
  const contentFiles = VOCABULARY_FILES.map((rel) =>
    path.join(skillDir, rel),
  ).filter((file) => fs.existsSync(file));
  const extracted = extractTailwindConfig(skillDir);
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `ebex-assets-${skillId}-`),
  );
  const configPath = path.join(tmpDir, "tailwind.config.cjs");
  const inputPath = path.join(tmpDir, "input.css");
  const outputPath = path.join(skillDir, "assets", "subset.css");

  const config = {
    content: { files: contentFiles },
    safelist: buildSafelist().map(({ pattern, variants }) => ({
      pattern: `__RE__${pattern}__RE__`,
      variants,
    })),
    theme: extracted?.theme ?? {},
  };
  // safelist の pattern は正規表現リテラルでなければならないので、埋め込み時に復元する
  const serialized = JSON.stringify(config, null, 2).replace(
    /"__RE__(.*?)__RE__"/g,
    (_, body) => `/${body.replace(/\\\\/g, "\\")}/`,
  );

  fs.writeFileSync(configPath, `module.exports = ${serialized};\n`, "utf8");
  fs.writeFileSync(
    inputPath,
    "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
    "utf8",
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Windows では .cmd を直接 spawn できない（EINVAL）ため shell 経由で起動する
  const quote = (value) => `"${value}"`;
  execFileSync(
    "npx",
    [
      "--yes",
      TAILWIND_VERSION,
      "-c",
      quote(configPath),
      "-i",
      quote(inputPath),
      "-o",
      quote(outputPath),
      "--minify",
    ],
    { stdio: ["ignore", "ignore", "pipe"], cwd: APP_ROOT, shell: true },
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
  return { bytes: fs.statSync(outputPath).size, themed: Boolean(extracted) };
}

function main() {
  const only = process.argv[2];
  const skills = only ? TARGET_SKILLS.filter((s) => s === only) : TARGET_SKILLS;
  if (skills.length === 0) {
    console.error(`対象スキルが見つかりません: ${only}`);
    process.exit(1);
  }

  for (const skillId of skills) {
    const skillDir = path.join(SKILLS_DIR, skillId);
    if (!fs.existsSync(skillDir)) {
      console.error(`スキルがありません: ${skillId}`);
      process.exit(1);
    }
    log(`\n[${skillId}]`);

    const names = collectIconNames(skillDir);
    const icons = writeIconsJson(skillDir, names);
    log(
      `  icons.json   ${icons.count} 個 / ${(icons.bytes / 1024).toFixed(1)}KB` +
        (icons.missing.length
          ? `  （lucide に無い名前: ${icons.missing.join(", ")}）`
          : ""),
    );

    const css = buildSubsetCss(skillId, skillDir);
    log(
      `  subset.css   ${(css.bytes / 1024).toFixed(1)}KB` +
        (css.themed ? "  （額縁の tailwind.config を反映）" : ""),
    );
  }
  log("");
}

main();
