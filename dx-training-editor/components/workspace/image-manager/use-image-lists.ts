"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkImageStorageConnection,
  getImageStorageMode,
} from "@/lib/image-api-client";
import { fetchImageList, type ImageListScope } from "@/lib/image-list-client";
import { WORKSPACE_SETTINGS_CHANGED_EVENT } from "@/lib/workspace-settings";
import type { ImageAsset } from "@/lib/schema";
import { tabToScope } from "@/components/workspace/image-manager/image-manager-utils";
import type { ImageManagerTab } from "@/components/workspace/image-manager/types";

type RefreshOptions = { silent?: boolean };

export function useImageLists(options: {
  pane4Open: boolean;
  activeTab: ImageManagerTab;
}) {
  const { pane4Open, activeTab } = options;

  const [stagingFiles, setStagingFiles] = useState<ImageAsset[]>([]);
  const [aiStagingFiles, setAiStagingFiles] = useState<ImageAsset[]>([]);
  const [webStagingFiles, setWebStagingFiles] = useState<ImageAsset[]>([]);
  const [promotedFiles, setPromotedFiles] = useState<ImageAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [storageConnectionError, setStorageConnectionError] = useState(false);

  const applyScopeFiles = useCallback((scope: ImageListScope, files: ImageAsset[]) => {
    switch (scope) {
      case "used":
        setPromotedFiles(files);
        break;
      case "uploaded":
        setStagingFiles(files);
        break;
      case "ai":
        setAiStagingFiles(files);
        break;
      case "web":
        setWebStagingFiles(files);
        break;
    }
  }, []);

  const refreshScope = useCallback(
    async (scope: ImageListScope, refreshOptions?: RefreshOptions) => {
      if (!refreshOptions?.silent) setLoading(true);
      try {
        const result = await fetchImageList(scope);
        let storageError = result.storageConnectionError;

        if (!storageError && getImageStorageMode() === "storage" && scope !== "used") {
          storageError = !(await checkImageStorageConnection());
        }

        setStorageConnectionError(storageError);
        applyScopeFiles(scope, scope === "used" && storageError ? [] : result.files);
      } finally {
        if (!refreshOptions?.silent) setLoading(false);
      }
    },
    [applyScopeFiles],
  );

  const refreshScopes = useCallback(
    async (scopes: ImageListScope[], refreshOptions?: RefreshOptions) => {
      if (!refreshOptions?.silent) setLoading(true);
      try {
        let storageError = getImageStorageMode() === "storage" && !(await checkImageStorageConnection());

        const results = await Promise.all(
          scopes.map(async (scope) => [scope, await fetchImageList(scope)] as const),
        );
        for (const [scope, result] of results) {
          if (result.storageConnectionError) storageError = true;
          if (scope === "used" && (storageError || result.storageConnectionError)) {
            applyScopeFiles(scope, []);
          } else {
            applyScopeFiles(scope, result.files);
          }
        }
        setStorageConnectionError(storageError);
      } finally {
        if (!refreshOptions?.silent) setLoading(false);
      }
    },
    [applyScopeFiles],
  );

  useEffect(() => {
    if (pane4Open) {
      void refreshScope(tabToScope(activeTab));
    }
  }, [pane4Open, activeTab, refreshScope]);

  useEffect(() => {
    const onSettingsChanged = () => {
      if (pane4Open) void refreshScope(tabToScope(activeTab));
    };
    window.addEventListener(WORKSPACE_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    return () =>
      window.removeEventListener(WORKSPACE_SETTINGS_CHANGED_EVENT, onSettingsChanged);
  }, [pane4Open, activeTab, refreshScope]);

  return {
    stagingFiles,
    aiStagingFiles,
    webStagingFiles,
    promotedFiles,
    loading,
    storageConnectionError,
    refreshScope,
    refreshScopes,
  };
}
