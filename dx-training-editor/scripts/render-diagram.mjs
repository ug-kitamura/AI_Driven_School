#!/usr/bin/env node
/**
 * Usage: node scripts/render-diagram.mjs <htmlFile> <outputPng>
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function wrapFragment(fragment) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Noto Sans JP"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          },
        },
      },
    };
  </script>
</head>
<body class="bg-white m-0 p-4 font-sans antialiased">
  <div id="capture-root">${fragment}</div>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>if (window.lucide) lucide.createIcons();</script>
</body>
</html>`;
}

async function main() {
  const htmlPath = process.argv[2];
  const outPath = process.argv[3];
  if (!htmlPath || !outPath) {
    console.error("Usage: node scripts/render-diagram.mjs <htmlFile> <outputPng>");
    process.exit(1);
  }

  const fragment = await fs.readFile(htmlPath, "utf8");
  const fullHtml = wrapFragment(fragment);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 768, height: 600 },
      deviceScaleFactor: 2,
    });
    await page.setContent(fullHtml, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const root = page.locator("#capture-root");
    await root.waitFor({ state: "visible", timeout: 15000 });
    const box = await root.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) {
      throw new Error("capture-root has no visible bounding box");
    }
    await page.screenshot({
      path: outPath,
      type: "png",
      clip: box,
    });
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
