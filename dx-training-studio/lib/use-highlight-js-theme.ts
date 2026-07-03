"use client";

import { useEffect } from "react";

const HLJS_LINK_ID = "hljs-lesson-preview-theme";

let lightHref: string | null = null;
let darkHref: string | null = null;

async function getHighlightJsStylesheetHref(isDark: boolean): Promise<string> {
  if (isDark) {
    darkHref ??= (
      await import("@/styles/hljs/github-dark.css?url")
    ).default;
    return darkHref;
  }

  lightHref ??= (
    await import("@/styles/hljs/github-light.css?url")
  ).default;
  return lightHref;
}

/** Pane3 プレビュー用 highlight.js テーマ（GitHub / GitHub Dark）を html.dark に合わせて切り替える */
export function useHighlightJsTheme(isDark: boolean) {
  useEffect(() => {
    let cancelled = false;

    const apply = async () => {
      document.getElementById(HLJS_LINK_ID)?.remove();

      const href = await getHighlightJsStylesheetHref(isDark);
      if (cancelled) return;

      const link = document.createElement("link");
      link.id = HLJS_LINK_ID;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    };

    void apply();

    return () => {
      cancelled = true;
      document.getElementById(HLJS_LINK_ID)?.remove();
    };
  }, [isDark]);
}
