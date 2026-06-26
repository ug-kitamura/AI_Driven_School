"use client";

import { useEffect, useState } from "react";
import {
  loadWorkspaceSettings,
  resolveThemeClass,
} from "@/lib/workspace-settings";

function readDarkFromDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function readDarkFromSettings(): boolean {
  if (typeof window === "undefined") return false;
  return resolveThemeClass(loadWorkspaceSettings().theme) === "dark";
}

/** 設定テーマ + html.dark クラスに追従する */
export function useResolvedDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof window === "undefined"
      ? false
      : readDarkFromDocument() || readDarkFromSettings(),
  );

  useEffect(() => {
    const sync = () => setIsDark(readDarkFromDocument());

    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const settings = loadWorkspaceSettings();
    if (settings.theme !== "system") {
      return () => obs.disconnect();
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => sync();
    mq.addEventListener("change", onMq);
    return () => {
      obs.disconnect();
      mq.removeEventListener("change", onMq);
    };
  }, []);

  return isDark;
}
