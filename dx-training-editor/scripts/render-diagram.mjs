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
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            custom: {
              bg: '#FFFFFF',
              surface: '#F8FAFC',
              hover: '#F1F5F9',
              border: '#E2E8F0',
              accent: '#3B82F6',
              'accent-light': '#2563EB',
              text: '#1E293B',
              muted: '#64748B',
              dim: '#94A3B8',
              positive: '#10B981',
              negative: '#EF4444',
              warning: '#F59E0B',
            }
          },
          fontFamily: {
            sans: ['"Noto Sans JP"', '"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', '"Yu Gothic UI"', '"Meiryo"', 'sans-serif'],
          }
        }
      }
    };
  </script>
</head>
<body class="bg-custom-bg text-slate-600 antialiased m-0 p-4 font-sans">
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
    await page.setContent(fullHtml, { waitUntil: "load", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(800);

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
