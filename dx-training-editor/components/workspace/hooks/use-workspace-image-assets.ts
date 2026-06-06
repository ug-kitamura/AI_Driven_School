"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeImageLogicalPath } from "@/lib/image-path";
import { fetchAvailableImagePaths } from "@/lib/preview-image-assets";

export function useWorkspaceImageAssets() {
  const [imageAssetsRevision, setImageAssetsRevision] = useState(0);
  const [availableImagePaths, setAvailableImagePaths] = useState<Set<string> | null>(
    null,
  );

  const notifyImageAssetsChanged = useCallback(
    (removedPaths?: string | string[]) => {
      if (removedPaths) {
        const list = Array.isArray(removedPaths) ? removedPaths : [removedPaths];
        setAvailableImagePaths((prev) => {
          if (!prev) return prev;
          const next = new Set(prev);
          for (const path of list) {
            next.delete(normalizeImageLogicalPath(path));
          }
          return next;
        });
      }
      setImageAssetsRevision((v) => v + 1);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchAvailableImagePaths().then((paths) => {
      if (!cancelled) setAvailableImagePaths(paths);
    });
    return () => {
      cancelled = true;
    };
  }, [imageAssetsRevision]);

  return {
    availableImagePaths,
    imageAssetsRevision,
    notifyImageAssetsChanged,
  };
}
