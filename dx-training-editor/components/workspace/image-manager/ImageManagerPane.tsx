"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { type ImageGridItem } from "@/components/workspace/ImageGrid";
import { ImageLightbox } from "@/components/workspace/ImageLightbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildUsedImageRows } from "@/lib/build-used-image-rows";
import {
  countImageRefsInSeries,
  indexImageRefLocations,
  isSeriesUnusedFilter,
  usedRowMatchesFilter,
  type UsedImageFilter,
} from "@/lib/extract-image-refs";
import {
  isAllowedUploadMime,
  isMp4FileName,
  MAX_MP4_BYTES,
  toImageMarkdown,
} from "@/lib/image-path";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";
import type { ImageAsset } from "@/lib/schema";
import { AiImagesTab } from "@/components/workspace/image-manager/AiImagesTab";
import { UploadImagesTab } from "@/components/workspace/image-manager/UploadImagesTab";
import { UsedImagesTab } from "@/components/workspace/image-manager/UsedImagesTab";
import { WebImagesTab } from "@/components/workspace/image-manager/WebImagesTab";
import {
  AI_KEY_ERROR,
  AI_PIXABAY_KEY_ERROR,
  FILTER_ALL,
  FILTER_UNUSED,
  IMAGE_MANAGER_TABS,
  MP4_SIZE_ERROR,
} from "@/components/workspace/image-manager/image-manager-constants";
import {
  aiRequestHeaders,
  tabToScope,
} from "@/components/workspace/image-manager/image-manager-utils";
import type {
  ImageManagerPaneProps,
  ImageManagerTab,
  PendingDelete,
  TabNotice,
} from "@/components/workspace/image-manager/types";
import { useImageLists } from "@/components/workspace/image-manager/use-image-lists";
import { usePromoteAndInsert } from "@/components/workspace/image-manager/use-promote-and-insert";

export function ImageManagerPane({
  series,
  lesson,
  pane3Mode,
  onInsertImage,
  editorCommentPrompt,
  editorCursorOffset,
  pane4Open,
  onTogglePane4,
  onImageAssetsChanged,
}: ImageManagerPaneProps) {
  const [activeTab, setActiveTab] = useState<ImageManagerTab>("used");
  const [aiPrompt, setAiPrompt] = useState("");
  const [webPrompt, setWebPrompt] = useState("");
  const [aiStagingAlts, setAiStagingAlts] = useState<Record<string, string>>({});
  const [webStagingAlts, setWebStagingAlts] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [webSuggesting, setWebSuggesting] = useState(false);
  const [tabNotices, setTabNotices] = useState<
    Partial<Record<ImageManagerTab, TabNotice>>
  >({});
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [usedFilter, setUsedFilter] = useState<UsedImageFilter>({
    seriesId: null,
    courseId: null,
    lessonId: null,
  });
  const tabScrollRef = useRef<HTMLDivElement>(null);

  const closePreview = useCallback(() => {
    setPreviewPath(null);
  }, []);

  const {
    stagingFiles,
    aiStagingFiles,
    webStagingFiles,
    promotedFiles,
    loading,
    refreshScope,
    refreshScopes,
  } = useImageLists({ pane4Open, activeTab });

  const refCounts = useMemo(
    () => countImageRefsInSeries(series),
    [series],
  );

  const refLocations = useMemo(
    () => indexImageRefLocations(series),
    [series],
  );

  const usedRows = useMemo(
    () => buildUsedImageRows(promotedFiles, refCounts),
    [promotedFiles, refCounts],
  );

  const filteredUsedRows = useMemo(
    () =>
      usedRows.filter((row) =>
        usedRowMatchesFilter(
          row.path,
          row.referenceCount,
          usedFilter,
          refLocations,
        ),
      ),
    [usedRows, usedFilter, refLocations],
  );

  useEffect(() => {
    if (editorCommentPrompt !== null) {
      setAiPrompt(editorCommentPrompt);
      setWebPrompt(editorCommentPrompt);
    }
  }, [editorCommentPrompt]);

  useEffect(() => {
    setPreviewPath(null);
  }, [activeTab]);

  const showNotice = useCallback(
    (tab: ImageManagerTab, message: string, tone: "error" | "success") => {
      setTabNotices((prev) => ({ ...prev, [tab]: { message, tone } }));
    },
    [],
  );

  const clearNotice = useCallback((tab: ImageManagerTab) => {
    setTabNotices((prev) => {
      if (!(tab in prev)) return prev;
      const next = { ...prev };
      delete next[tab];
      return next;
    });
  }, []);

  const tryInsert = useCallback(
    (markdown: string, tab: ImageManagerTab) => {
      const ok = onInsertImage(markdown);
      if (!ok) {
        showNotice(tab, "編集モードに切り替えてから挿入してください", "error");
      } else {
        clearNotice(tab);
      }
      return ok;
    },
    [onInsertImage, showNotice, clearNotice],
  );

  const { promoteAndInsert } = usePromoteAndInsert({
    tryInsert,
    refreshScopes,
    showNotice,
    onImageAssetsChanged,
  });

  const handleInsertPromoted = useCallback(
    (item: ImageGridItem) => {
      tryInsert(toImageMarkdown(item.path), "used");
    },
    [tryInsert],
  );

  const handleInsertStaging = useCallback(
    (item: ImageGridItem) =>
      promoteAndInsert(item, { tab: "upload", stagingScope: "uploaded" }),
    [promoteAndInsert],
  );

  const handleInsertAiStaging = useCallback(
    (item: ImageGridItem) =>
      promoteAndInsert(item, {
        tab: "ai",
        stagingScope: "ai",
        resolveAlt: (i) => aiStagingAlts[i.path] ?? aiStagingAlts[i.name],
      }),
    [promoteAndInsert, aiStagingAlts],
  );

  const handleInsertWebStaging = useCallback(
    (item: ImageGridItem) =>
      promoteAndInsert(item, {
        tab: "web",
        stagingScope: "web",
        resolveAlt: (i) => webStagingAlts[i.path] ?? webStagingAlts[i.name],
      }),
    [promoteAndInsert, webStagingAlts],
  );

  const executeDelete = useCallback(
    async (item: PendingDelete, tab: ImageManagerTab, force = false) => {
      const params = new URLSearchParams({ path: item.path });
      if (force && item.referenceCount) {
        params.set("force", "1");
        params.set("referenceCount", String(item.referenceCount));
      }
      const res = await fetch(`/api/images/file?${params}`, { method: "DELETE" });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        showNotice(tab, data.error ?? "削除に失敗しました", "error");
        return;
      }
      await refreshScope(tabToScope(tab), { silent: true });
      onImageAssetsChanged?.(item.path);
      closePreview();
    },
    [refreshScope, showNotice, onImageAssetsChanged, closePreview],
  );

  const requestDelete = useCallback(
    (item: ImageGridItem, tab: ImageManagerTab, referenceCount = 0) => {
      if (item.missing) return;
      const kind =
        tab === "used" && referenceCount > 0 ? "referenced" : "simple";
      setPendingDelete({ ...item, referenceCount, kind, tab });
    },
    [],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      let uploaded = false;
      for (const file of Array.from(files)) {
        if (!isAllowedUploadMime(file.type, file.name)) continue;
        const isMp4 =
          file.type === "video/mp4" ||
          (file.type === "" && isMp4FileName(file.name));
        if (isMp4 && file.size > MAX_MP4_BYTES) {
          showNotice("upload", MP4_SIZE_ERROR, "error");
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        form.append("source", "uploaded");
        const res = await fetch("/api/images/upload", { method: "POST", body: form });
        if (!res.ok) {
          const data: { error?: string } = await res.json();
          showNotice("upload", data.error ?? "アップロードに失敗しました", "error");
          continue;
        }
        uploaded = true;
      }
      if (uploaded) clearNotice("upload");
      await refreshScope("uploaded", { silent: true });
      setActiveTab("upload");
    },
    [refreshScope, showNotice, clearNotice],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imageFiles: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith("image/") || item.type === "video/mp4") {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) void uploadFiles(imageFiles);
    },
    [uploadFiles],
  );

  const handleGenerate = useCallback(async () => {
    if (!lesson) return;
    const prompt = aiPrompt.trim();
    if (!prompt) {
      showNotice("ai", "プロンプトを入力してください", "error");
      return;
    }
    const settings = loadWorkspaceSettings();
    const headers = aiRequestHeaders(settings);
    setGenerating(true);
    clearNotice("ai");
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ lesson, prompt }),
      });
      let data: { file?: ImageAsset; alt?: string; error?: string };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        showNotice("ai", "サーバー応答の解析に失敗しました", "error");
        return;
      }
      if (!res.ok || !data.file) {
        showNotice(
          "ai",
          data.error ??
            (res.status === 401 ? AI_KEY_ERROR : "画像の生成に失敗しました"),
          "error",
        );
        return;
      }
      if (data.alt) {
        setAiStagingAlts((prev) => ({
          ...prev,
          [data.file!.path]: data.alt!,
          [data.file!.name]: data.alt!,
        }));
      }
      await refreshScope("ai", { silent: true });
      showNotice("ai", `AI staging に保存しました: ${data.file.name}`, "success");
    } catch (error) {
      showNotice(
        "ai",
        error instanceof Error ? error.message : "画像の生成に失敗しました",
        "error",
      );
    } finally {
      setGenerating(false);
    }
  }, [lesson, aiPrompt, refreshScope, showNotice, clearNotice]);

  const handleAutoFill = useCallback(async () => {
    if (!lesson) return;

    const settings = loadWorkspaceSettings();
    const headers = aiRequestHeaders(settings);
    const seedPrompt = editorCommentPrompt ?? undefined;

    setSuggesting(true);
    clearNotice("ai");
    try {
      const res = await fetch("/api/images/suggest-prompt", {
        method: "POST",
        headers,
        body: JSON.stringify({
          lesson,
          cursorOffset: editorCursorOffset ?? 0,
          seedPrompt,
        }),
      });
      let data: { prompt?: string; error?: string };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        showNotice("ai", "サーバー応答の解析に失敗しました", "error");
        return;
      }
      if (!res.ok || !data.prompt) {
        showNotice(
          "ai",
          data.error ??
            (res.status === 401 ? AI_KEY_ERROR : "プロンプトの自動入力に失敗しました"),
          "error",
        );
        return;
      }
      setAiPrompt(data.prompt);
    } catch (error) {
      showNotice(
        "ai",
        error instanceof Error ? error.message : "プロンプトの自動入力に失敗しました",
        "error",
      );
    } finally {
      setSuggesting(false);
    }
  }, [
    lesson,
    editorCommentPrompt,
    editorCursorOffset,
    clearNotice,
    showNotice,
  ]);

  const handleResetPrompt = useCallback(() => {
    setAiPrompt("");
    clearNotice("ai");
  }, [clearNotice]);

  const handleSearch = useCallback(async () => {
    if (!lesson) return;
    const prompt = webPrompt.trim();
    if (!prompt) {
      showNotice("web", "プロンプトを入力してください", "error");
      return;
    }
    const settings = loadWorkspaceSettings();
    const headers = aiRequestHeaders(settings, true);
    setSearching(true);
    clearNotice("web");
    try {
      const res = await fetch("/api/images/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ lesson, prompt }),
      });
      let data: {
        results?: Array<{ file: ImageAsset; alt?: string }>;
        error?: string;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        showNotice("web", "サーバー応答の解析に失敗しました", "error");
        return;
      }
      if (!res.ok || !data.results?.length) {
        showNotice(
          "web",
          data.error ??
            (res.status === 401 ? AI_PIXABAY_KEY_ERROR : "画像の検索に失敗しました"),
          "error",
        );
        return;
      }
      setWebStagingAlts((prev) => {
        const next = { ...prev };
        for (const item of data.results!) {
          if (item.alt) {
            next[item.file.path] = item.alt;
            next[item.file.name] = item.alt;
          }
        }
        return next;
      });
      await refreshScope("web", { silent: true });
      showNotice(
        "web",
        `Web staging に ${data.results.length} 件保存しました`,
        "success",
      );
    } catch (error) {
      showNotice(
        "web",
        error instanceof Error ? error.message : "画像の検索に失敗しました",
        "error",
      );
    } finally {
      setSearching(false);
    }
  }, [lesson, webPrompt, refreshScope, showNotice, clearNotice]);

  const handleWebAutoFill = useCallback(async () => {
    if (!lesson) return;

    const settings = loadWorkspaceSettings();
    const headers = aiRequestHeaders(settings);
    const seedPrompt = editorCommentPrompt ?? undefined;

    setWebSuggesting(true);
    clearNotice("web");
    try {
      const res = await fetch("/api/images/suggest-web-prompt", {
        method: "POST",
        headers,
        body: JSON.stringify({
          lesson,
          cursorOffset: editorCursorOffset ?? 0,
          seedPrompt,
        }),
      });
      let data: { prompt?: string; error?: string };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        showNotice("web", "サーバー応答の解析に失敗しました", "error");
        return;
      }
      if (!res.ok || !data.prompt) {
        showNotice(
          "web",
          data.error ??
            (res.status === 401 ? AI_KEY_ERROR : "プロンプトの自動入力に失敗しました"),
          "error",
        );
        return;
      }
      setWebPrompt(data.prompt);
    } catch (error) {
      showNotice(
        "web",
        error instanceof Error ? error.message : "プロンプトの自動入力に失敗しました",
        "error",
      );
    } finally {
      setWebSuggesting(false);
    }
  }, [
    lesson,
    editorCommentPrompt,
    editorCursorOffset,
    clearNotice,
    showNotice,
  ]);

  const handleResetWebPrompt = useCallback(() => {
    setWebPrompt("");
    clearNotice("web");
  }, [clearNotice]);

  const aiStagingGridItems: ImageGridItem[] = aiStagingFiles.map((file) => ({
    path: file.path,
    name: file.name,
    showInsert: true,
    showDelete: true,
  }));

  const webStagingGridItems: ImageGridItem[] = webStagingFiles.map((file) => ({
    path: file.path,
    name: file.name,
    showInsert: true,
    showDelete: true,
  }));

  const stagingGridItems: ImageGridItem[] = stagingFiles.map((file) => ({
    path: file.path,
    name: file.name,
    showInsert: true,
    showDelete: true,
  }));

  const usedGridItems: ImageGridItem[] = filteredUsedRows.map((row) => ({
    path: row.path,
    name: row.name,
    missing: row.missing,
    statusLabel: row.missing
      ? "画像が存在しません"
      : row.referenceCount > 0
        ? `使用中: ${row.referenceCount}`
        : "未使用",
    showInsert: !row.missing,
    showDelete: !row.missing,
  }));

  const previewItems: ImageGridItem[] = useMemo(() => {
    switch (activeTab) {
      case "used":
        return usedGridItems;
      case "upload":
        return stagingGridItems;
      case "ai":
        return aiStagingGridItems;
      case "web":
        return webStagingGridItems;
      default:
        return [];
    }
  }, [
    activeTab,
    usedGridItems,
    stagingGridItems,
    aiStagingGridItems,
    webStagingGridItems,
  ]);

  const previewableItems: ImageGridItem[] = useMemo(
    () => previewItems.filter((item) => !item.missing),
    [previewItems],
  );

  const previewIndex = useMemo(() => {
    if (!previewPath) return null;
    const idx = previewableItems.findIndex((i) => i.path === previewPath);
    return idx >= 0 ? idx : null;
  }, [previewPath, previewableItems]);

  const openPreview = useCallback((item: ImageGridItem) => {
    if (item.missing) return;
    setPreviewPath(item.path);
  }, []);

  const currentPreviewItem =
    previewIndex !== null ? previewableItems[previewIndex] : null;

  const seriesUnusedMode = isSeriesUnusedFilter(usedFilter);

  const filterCourses = useMemo(() => {
    if (seriesUnusedMode || !usedFilter.seriesId) return [];
    const s = series.find((x) => x.id === usedFilter.seriesId);
    return s?.courses ?? [];
  }, [series, usedFilter.seriesId, seriesUnusedMode]);

  const filterLessons = useMemo(() => {
    if (!usedFilter.courseId) return [];
    for (const s of series) {
      const course = s.courses.find((c) => c.id === usedFilter.courseId);
      if (course) return course.lessons;
    }
    return [];
  }, [series, usedFilter.courseId]);

  const usedFilterSeriesLabel = useMemo(() => {
    if (seriesUnusedMode) return "（未使用）";
    if (!usedFilter.seriesId) return "すべてのシリーズ";
    return series.find((s) => s.id === usedFilter.seriesId)?.name ?? "シリーズ";
  }, [usedFilter.seriesId, series, seriesUnusedMode]);

  const usedFilterCourseLabel = useMemo(() => {
    if (seriesUnusedMode) return "（未使用）";
    if (!usedFilter.courseId) return "すべてのコース";
    return (
      filterCourses.find((c) => c.id === usedFilter.courseId)?.name ?? "コース"
    );
  }, [usedFilter.courseId, filterCourses, seriesUnusedMode]);

  const usedFilterLessonLabel = useMemo(() => {
    if (seriesUnusedMode) return "（未使用）";
    if (!usedFilter.lessonId) return "すべてのレッスン";
    return (
      filterLessons.find((l) => l.id === usedFilter.lessonId)?.lesson ?? "レッスン"
    );
  }, [usedFilter.lessonId, filterLessons, seriesUnusedMode]);

  const seriesSelectValue = seriesUnusedMode
    ? FILTER_UNUSED
    : (usedFilter.seriesId ?? FILTER_ALL);

  const resetUsedFilter = useCallback(() => {
    setUsedFilter({ seriesId: null, courseId: null, lessonId: null });
  }, []);

  if (!pane4Open) {
    return (
      <div className="flex w-12 flex-shrink-0 flex-col items-center border-l border-border bg-card py-3">
        <Pane4Toggle open={false} onToggle={onTogglePane4} />
      </div>
    );
  }

  return (
    <PaneWheelRoot
      scrollRef={tabScrollRef}
      className="bg-card"
      onPaste={handlePaste}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-2 py-0">
        <div className="flex h-full min-w-0 items-center">
          {IMAGE_MANAGER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex h-full items-center gap-1 px-2 text-[10px] font-medium transition-colors",
                activeTab === tab.value
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <Pane4Toggle open={true} onToggle={onTogglePane4} />
      </div>

      {pane3Mode !== "raw" && activeTab !== "ai" && activeTab !== "web" ? (
        <div className="border-b border-border bg-muted/40 px-3 py-1 text-[10px] text-muted-foreground">
          画像の挿入は編集モードでのみ利用できます
        </div>
      ) : null}

      <div
        ref={tabScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        {loading && activeTab !== "ai" && activeTab !== "web" ? (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            読み込み中...
          </div>
        ) : null}

        {activeTab === "used" && !loading ? (
          <UsedImagesTab
            series={series}
            usedFilter={usedFilter}
            onUsedFilterChange={setUsedFilter}
            seriesSelectValue={seriesSelectValue}
            usedFilterSeriesLabel={usedFilterSeriesLabel}
            usedFilterCourseLabel={usedFilterCourseLabel}
            usedFilterLessonLabel={usedFilterLessonLabel}
            seriesUnusedMode={seriesUnusedMode}
            filterCourses={filterCourses}
            filterLessons={filterLessons}
            gridItems={usedGridItems}
            usedRows={usedRows}
            notice={tabNotices.used}
            onResetFilter={resetUsedFilter}
            onPreview={openPreview}
            onInsert={handleInsertPromoted}
            onDelete={(item, referenceCount) =>
              requestDelete(item, "used", referenceCount)
            }
          />
        ) : null}

        {activeTab === "upload" && !loading ? (
          <UploadImagesTab
            gridItems={stagingGridItems}
            notice={tabNotices.upload}
            onUploadFiles={uploadFiles}
            onPreview={openPreview}
            onInsert={handleInsertStaging}
            onDelete={(item) => requestDelete(item, "upload")}
          />
        ) : null}

        {activeTab === "ai" ? (
          <AiImagesTab
            hasLesson={!!lesson}
            prompt={aiPrompt}
            onPromptChange={setAiPrompt}
            generating={generating}
            suggesting={suggesting}
            gridItems={aiStagingGridItems}
            notice={tabNotices.ai}
            onGenerate={() => void handleGenerate()}
            onAutoFill={() => void handleAutoFill()}
            onResetPrompt={handleResetPrompt}
            onPreview={openPreview}
            onInsert={handleInsertAiStaging}
            onDelete={(item) => requestDelete(item, "ai")}
          />
        ) : null}

        {activeTab === "web" ? (
          <WebImagesTab
            hasLesson={!!lesson}
            prompt={webPrompt}
            onPromptChange={setWebPrompt}
            searching={searching}
            suggesting={webSuggesting}
            gridItems={webStagingGridItems}
            notice={tabNotices.web}
            onSearch={() => void handleSearch()}
            onAutoFill={() => void handleWebAutoFill()}
            onResetPrompt={handleResetWebPrompt}
            onPreview={openPreview}
            onInsert={handleInsertWebStaging}
            onDelete={(item) => requestDelete(item, "web")}
          />
        ) : null}
      </div>

      {previewIndex !== null && currentPreviewItem ? (
        <ImageLightbox
          open
          onOpenChange={(open) => !open && closePreview()}
          items={previewableItems}
          index={previewIndex}
          onIndexChange={(idx) => {
            const item = previewableItems[idx];
            if (item) setPreviewPath(item.path);
          }}
          showInsert={currentPreviewItem.showInsert}
          showDelete={currentPreviewItem.showDelete}
          onInsert={() => {
            if (!currentPreviewItem) return;
            closePreview();
            switch (activeTab) {
              case "used":
                handleInsertPromoted(currentPreviewItem);
                break;
              case "upload":
                void handleInsertStaging(currentPreviewItem);
                break;
              case "ai":
                void handleInsertAiStaging(currentPreviewItem);
                break;
              case "web":
                void handleInsertWebStaging(currentPreviewItem);
                break;
            }
          }}
          onDelete={() => {
            if (!currentPreviewItem) return;
            if (activeTab === "used") {
              const row = usedRows.find((r) => r.path === currentPreviewItem.path);
              requestDelete(
                currentPreviewItem,
                "used",
                row?.referenceCount ?? 0,
              );
              return;
            }
            requestDelete(currentPreviewItem, activeTab);
          }}
        />
      ) : null}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>画像を削除しますか？</AlertDialogTitle>
            {pendingDelete?.kind === "referenced" ? (
              <AlertDialogDescription>
                {pendingDelete.name} は {pendingDelete.referenceCount}{" "}
                箇所で使用しています。
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  void executeDelete(
                    pendingDelete,
                    pendingDelete.tab,
                    pendingDelete.kind === "referenced",
                  );
                  setPendingDelete(null);
                }
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PaneWheelRoot>
  );
}
