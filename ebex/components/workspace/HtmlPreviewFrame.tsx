"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useResolvedDarkMode } from "@/lib/use-resolved-dark-mode";

/** 注入した style 要素を再注入時に見分けるための印 */
const SCROLLBAR_STYLE_ID = "ebex-workspace-scrollbar";

/**
 * iframe は別文書なので親の :root に定義した custom property を継承しない。
 * 親側で解決した色リテラルを含む CSS を組み立てる。いずれかが解決できない場合は
 * 代替色を使わず null を返し、ブラウザ既定のスクロールバーへ倒す。
 */
function buildScrollbarCss(): string | null {
  if (typeof document === "undefined") return null;
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim();

  const track = read("--workspace-scrollbar-track");
  const thumb = read("--workspace-scrollbar-thumb");
  const thumbHover = read("--workspace-scrollbar-thumb-hover");
  if (!track || !thumb || !thumbHover) return null;

  // 形状は app/globals.css の .workspace-scrollbar と揃える
  return `
html { scrollbar-width: thin; scrollbar-color: ${thumb} ${track}; }
html::-webkit-scrollbar { width: 10px; height: 10px; }
html::-webkit-scrollbar-track { background: ${track}; }
html::-webkit-scrollbar-thumb {
  background-color: ${thumb};
  border: 2px solid ${track};
  border-radius: 9999px;
}
html::-webkit-scrollbar-thumb:hover { background-color: ${thumbHover}; }
`;
}

/** 同じ iframe へ 2 回目以降に注入するときは既存の style を差し替える */
function applyScrollbarStyle(doc: Document): void {
  const css = buildScrollbarCss();
  const existing = doc.getElementById(SCROLLBAR_STYLE_ID);
  if (!css) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.textContent = css;
    return;
  }
  const style = doc.createElement("style");
  style.id = SCROLLBAR_STYLE_ID;
  style.textContent = css;
  (doc.head ?? doc.documentElement)?.appendChild(style);
}

function wrapHtmlForPreview(html: string): string {
  if (/<head[\s>]/i.test(html) || /<html[\s>]/i.test(html)) return html;
  return `<!DOCTYPE html><html><head></head><body>${html}</body></html>`;
}

/**
 * リンクによるナビゲーションを全面的に無効化し、同一文書内の `#id` アンカー
 * のみスクロールジャンプに変換する。ページ側スクリプトより先に奪うため
 * capture 段階で、親ウィンドウ側から contentDocument へ付与する。
 */
function interceptLinkClicks(doc: Document): void {
  doc.addEventListener(
    "click",
    (event) => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      event.preventDefault();
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("#") || href.length <= 1) return;
      const id = decodeURIComponent(href.slice(1));
      const dest = doc.getElementById(id) ?? doc.getElementsByName(id)[0];
      dest?.scrollIntoView({ block: "start" });
    },
    { capture: true },
  );
}

type Props = {
  content: string;
  isResizing?: boolean;
};

export function HtmlPreviewFrame({ content, isResizing = false }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isDark = useResolvedDarkMode();

  const srcDoc = useMemo(() => wrapHtmlForPreview(content), [content]);

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;

    interceptLinkClicks(doc);
    applyScrollbarStyle(doc);
  }, []);

  // テーマ切替で custom property の値が変わるため注入し直す
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    applyScrollbarStyle(doc);
  }, [isDark, srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title="HTML preview"
      sandbox="allow-scripts allow-same-origin"
      srcDoc={srcDoc}
      onLoad={handleLoad}
      className={cn(
        // block でないと inline 置換要素の baseline 分だけ親がはみ出す
        "block h-full w-full border-0 bg-white",
        isResizing && "pointer-events-none",
      )}
    />
  );
}
