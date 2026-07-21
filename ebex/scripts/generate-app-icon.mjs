#!/usr/bin/env node
/**
 * `images/logo_small.png` から `app/icon.png`（ブラウザタブのファヴィコン）を生成する。
 *
 * ブラウザはタブアイコンを正方形の枠に描画するため、縦長のロゴをそのまま置くと
 * 縦横比が崩れる。正方形キャンバスの中央にロゴを収め、余りを透明で埋めることで
 * 比を保ったまま正方形にする。
 *
 * Usage: node scripts/generate-app-icon.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

/**
 * キャンバス辺長 = ロゴ高さ × この倍率。整数倍にすることで、ロゴの拡大が
 * 再サンプリングを伴わず、縦横比も端数丸めなしで元画像と一致する。
 */
const SCALE = 2;

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourcePath = path.join(projectRoot, "images", "logo_small.png");
const outputPath = path.join(projectRoot, "app", "icon.png");

/** PNG の IHDR から幅・高さを読む。 */
function readPngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error(`not a PNG: ${sourcePath}`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function buildPage(dataUri, canvasSize) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;background:transparent;">
  <div style="width:${canvasSize}px;height:${canvasSize}px;display:flex;align-items:center;justify-content:center;">
    <img src="${dataUri}" style="height:100%;width:auto;display:block;">
  </div>
</body>
</html>`;
}

async function main() {
  const source = await fs.readFile(sourcePath);
  const { width, height } = readPngDimensions(source);
  if (width > height) {
    throw new Error(
      `logo must be portrait or square (got ${width}x${height}); ` +
        "adjust the canvas rule before regenerating",
    );
  }
  const canvasSize = height * SCALE;
  const dataUri = `data:image/png;base64,${source.toString("base64")}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: canvasSize, height: canvasSize },
      deviceScaleFactor: 1,
    });
    await page.setContent(buildPage(dataUri, canvasSize), {
      waitUntil: "load",
    });
    // 透明の余白を残すため omitBackground で背景を描画しない
    const png = await page.screenshot({ type: "png", omitBackground: true });
    await fs.writeFile(outputPath, png);
    console.log(
      `[generate-app-icon] wrote ${path.relative(projectRoot, outputPath)} ` +
        `(${canvasSize}x${canvasSize}, logo ${width * SCALE}x${height * SCALE})`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
