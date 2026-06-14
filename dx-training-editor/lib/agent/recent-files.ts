"use client";

import { useCallback, useState } from "react";

const DEFAULT_MAX = 5;

export function useRecentLessonFiles(max = DEFAULT_MAX) {
  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  const recordRecentFile = useCallback(
    (filePath: string) => {
      const normalized = filePath.replace(/\\/g, "/");
      if (!normalized.startsWith("contents/") || !normalized.endsWith(".md")) {
        return;
      }
      setRecentFiles((prev) =>
        [normalized, ...prev.filter((path) => path !== normalized)].slice(0, max),
      );
    },
    [max],
  );

  return { recentFiles, recordRecentFile };
}
