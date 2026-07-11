"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const OVERFLOW_STYLE =
  "<style>html,body{overflow:hidden!important;margin:0;padding:0;}</style>";

function wrapHtmlForPreview(html: string): string {
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([\s>])/i, `<head$1${OVERFLOW_STYLE}`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([\s>])/i, `<html$1<head>${OVERFLOW_STYLE}</head>`);
  }
  return `<!DOCTYPE html><html><head>${OVERFLOW_STYLE}</head><body>${html}</body></html>`;
}

function measureDocumentHeight(doc: Document): number {
  const { documentElement, body } = doc;
  return Math.max(
    documentElement.scrollHeight,
    documentElement.offsetHeight,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
  );
}

function applyOverflowHidden(doc: Document): void {
  const style = doc.createElement("style");
  style.textContent = "html, body { overflow: hidden !important; margin: 0; padding: 0; }";
  doc.head?.appendChild(style);
}

type Props = {
  content: string;
  isResizing?: boolean;
};

export function HtmlPreviewFrame({ content, isResizing = false }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const syncTimeoutRef = useRef<number[]>([]);
  const [height, setHeight] = useState(1);

  const srcDoc = useMemo(() => wrapHtmlForPreview(content), [content]);

  const syncHeight = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    const nextHeight = measureDocumentHeight(doc);
    setHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const handleLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;

    applyOverflowHidden(doc);
    syncHeight();

    observerRef.current?.disconnect();
    observerRef.current = new ResizeObserver(() => {
      syncHeight();
    });
    observerRef.current.observe(doc.body);
    observerRef.current.observe(doc.documentElement);

    requestAnimationFrame(syncHeight);
    syncTimeoutRef.current.push(window.setTimeout(syncHeight, 100));
    syncTimeoutRef.current.push(window.setTimeout(syncHeight, 500));
  }, [syncHeight]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      for (const id of syncTimeoutRef.current) {
        window.clearTimeout(id);
      }
      syncTimeoutRef.current = [];
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="HTML preview"
      sandbox="allow-scripts allow-same-origin"
      srcDoc={srcDoc}
      onLoad={handleLoad}
      className={cn(
        "min-h-px w-full border-0 bg-white",
        isResizing && "pointer-events-none",
      )}
      style={{ height }}
    />
  );
}
