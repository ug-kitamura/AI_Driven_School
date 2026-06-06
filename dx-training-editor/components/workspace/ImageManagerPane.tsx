"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  Upload,
  Sparkles,
  Search,
  SquareCheckBig,
  ImageIcon,
  Loader2,
  Wand2,
  RotateCcw,
  Pen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";
import { PaneWheelRoot } from "@/components/workspace/PaneWheelRoot";
import { ImageGrid, type ImageGridItem } from "@/components/workspace/ImageGrid";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { buildUsedImageRows } from "@/lib/build-used-image-rows";
import {
  countImageRefsInSeries,
  FILTER_SERIES_UNUSED,
  indexImageRefLocations,
  isSeriesUnusedFilter,
  isUsedImageFilterActive,
  usedRowMatchesFilter,
  type UsedImageFilter,
} from "@/lib/extract-image-refs";
import {
  isAllowedUploadMime,
  isMp4FileName,
  MAX_MP4_BYTES,
  toImageMarkdown,
} from "@/lib/image-path";
import {
  fetchImageList,
  scopesAfterPromote,
  type ImageListScope,
} from "@/lib/image-list-client";
import { loadWorkspaceSettings, type WorkspaceSettings } from "@/lib/workspace-settings";
import type { ImageAsset, Lesson, Series } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";

type Props = {
  series: Series[];
  lesson: Lesson | undefined;
  pane3Mode: Pane3Mode;
  onInsertImage: (markdown: string) => boolean;
  /** null = コメント外（プロンプト上書きしない）、string = コメント内テキスト */
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  pane4Open: boolean;
  onTogglePane4: () => void;
  onImageAssetsChanged?: (removedPaths?: string | string[]) => void;
};

type Tab = "used" | "upload" | "ai" | "web";

function tabToScope(tab: Tab): ImageListScope {
  switch (tab) {
    case "used":
      return "used";
    case "upload":
      return "uploaded";
    case "ai":
      return "ai";
    case "web":
      return "web";
  }
}

const TABS: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
  { value: "used", label: "Used", icon: <SquareCheckBig className="h-3 w-3" /> },
  { value: "upload", label: "UP", icon: <Upload className="h-3 w-3" /> },
  { value: "ai", label: "AI", icon: <Sparkles className="h-3 w-3" /> },
  { value: "web", label: "Web", icon: <Search className="h-3 w-3" /> },
];

type PendingDelete = ImageGridItem & {
  referenceCount: number;
  kind: "referenced" | "simple";
  tab: Tab;
};

type TabNotice = { message: string; tone: "error" | "success" };

const FILTER_ALL = "all";
const FILTER_UNUSED = "unused";

/** Pane4 タブ本文の左右インセット（プロンプト・ボタン・グリッドで共有） */
const PANE4_TAB_INSET = "px-3";

/** UP D&D・AI/Web プロンプト欄で共有する高さ（AI の生成ボタン上端に UP 下線を揃える） */
const PANE4_PROMPT_BLOCK_CLASS = "flex flex-col gap-2";
const PANE4_BUTTON_ROW_CLASS = "flex h-8 items-center justify-start gap-2";
const PANE4_TOP_BOX_CLASS =
  "flex h-[calc(96px+0.5rem)] flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center";
const PANE4_PROMPT_TEXTAREA_CLASS =
  "h-[96px] min-h-[96px] w-full resize-y overflow-y-auto rounded-lg border border-border bg-background px-3 pt-2 pb-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

const AI_KEY_ERROR =
  "AI API キーを設定（歯車）するか、サーバーに AI_API_KEY を設定してください";
const AI_PIXABAY_KEY_ERROR =
  "AI / Pixabay API キーを設定（歯車）するか、サーバー環境変数を設定してください";
const MP4_SIZE_ERROR =
  "MP4 は 3 MB 以下にしてください（10 秒以内の録画を推奨）";

function aiRequestHeaders(
  settings: WorkspaceSettings,
  includePixabay = false,
): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.aiApiKey) headers["x-ai-api-key"] = settings.aiApiKey;
  if (includePixabay && settings.pixabayApiKey) {
    headers["x-pixabay-api-key"] = settings.pixabayApiKey;
  }
  return headers;
}

function TabNoticeBanner({ notice }: { notice: TabNotice | undefined }) {
  if (!notice) return null;
  return (
    <div
      className={cn(
        "border-b px-3 py-1.5 text-[10px]",
        notice.tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
          : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
      )}
    >
      {notice.message}
    </div>
  );
}

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
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("used");
  const [stagingFiles, setStagingFiles] = useState<ImageAsset[]>([]);
  const [aiStagingFiles, setAiStagingFiles] = useState<ImageAsset[]>([]);
  const [webStagingFiles, setWebStagingFiles] = useState<ImageAsset[]>([]);
  const [promotedFiles, setPromotedFiles] = useState<ImageAsset[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [webPrompt, setWebPrompt] = useState("");
  const [aiStagingAlts, setAiStagingAlts] = useState<Record<string, string>>({});
  const [webStagingAlts, setWebStagingAlts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [webSuggesting, setWebSuggesting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [tabNotices, setTabNotices] = useState<Partial<Record<Tab, TabNotice>>>(
    {},
  );
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const closePreview = useCallback(() => {
    setPreviewPath(null);
  }, []);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [usedFilter, setUsedFilter] = useState<UsedImageFilter>({
    seriesId: null,
    courseId: null,
    lessonId: null,
  });
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    async (scope: ImageListScope, options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      try {
        const files = await fetchImageList(scope);
        applyScopeFiles(scope, files);
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [applyScopeFiles],
  );

  const refreshScopes = useCallback(
    async (scopes: ImageListScope[], options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true);
      try {
        const results = await Promise.all(
          scopes.map(async (scope) => [scope, await fetchImageList(scope)] as const),
        );
        for (const [scope, files] of results) {
          applyScopeFiles(scope, files);
        }
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [applyScopeFiles],
  );

  useEffect(() => {
    if (editorCommentPrompt !== null) {
      setAiPrompt(editorCommentPrompt);
      setWebPrompt(editorCommentPrompt);
    }
  }, [editorCommentPrompt]);

  useEffect(() => {
    if (pane4Open) {
      void refreshScope(tabToScope(activeTab));
    }
  }, [pane4Open, activeTab, refreshScope]);

  useEffect(() => {
    setPreviewPath(null);
  }, [activeTab]);

  const showNotice = useCallback(
    (tab: Tab, message: string, tone: "error" | "success") => {
      setTabNotices((prev) => ({ ...prev, [tab]: { message, tone } }));
    },
    [],
  );

  const clearNotice = useCallback((tab: Tab) => {
    setTabNotices((prev) => {
      if (!(tab in prev)) return prev;
      const next = { ...prev };
      delete next[tab];
      return next;
    });
  }, []);

  const tryInsert = useCallback(
    (markdown: string, tab: Tab) => {
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

  const handleInsertAiStaging = useCallback(
    async (item: ImageGridItem) => {
      const res = await fetch("/api/images/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagingPath: item.path }),
      });
      const data: { file?: ImageAsset; error?: string } = await res.json();
      if (!res.ok || !data.file) {
        showNotice("ai", data.error ?? "画像の promote に失敗しました", "error");
        return;
      }
      const alt = aiStagingAlts[item.path] ?? aiStagingAlts[item.name];
      if (tryInsert(toImageMarkdown(data.file.path, alt), "ai")) {
        await refreshScopes(scopesAfterPromote("ai"), { silent: true });
        onImageAssetsChanged?.();
      }
    },
    [tryInsert, refreshScopes, showNotice, aiStagingAlts, onImageAssetsChanged],
  );

  const handleInsertWebStaging = useCallback(
    async (item: ImageGridItem) => {
      const res = await fetch("/api/images/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagingPath: item.path }),
      });
      const data: { file?: ImageAsset; error?: string } = await res.json();
      if (!res.ok || !data.file) {
        showNotice("web", data.error ?? "画像の promote に失敗しました", "error");
        return;
      }
      const alt = webStagingAlts[item.path] ?? webStagingAlts[item.name];
      if (tryInsert(toImageMarkdown(data.file.path, alt), "web")) {
        await refreshScopes(scopesAfterPromote("web"), { silent: true });
        onImageAssetsChanged?.();
      }
    },
    [tryInsert, refreshScopes, showNotice, webStagingAlts, onImageAssetsChanged],
  );

  const handleInsertStaging = useCallback(
    async (item: ImageGridItem) => {
      const res = await fetch("/api/images/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagingPath: item.path }),
      });
      const data: { file?: ImageAsset; error?: string } = await res.json();
      if (!res.ok || !data.file) {
        showNotice("upload", data.error ?? "画像の promote に失敗しました", "error");
        return;
      }
      if (tryInsert(toImageMarkdown(data.file.path), "upload")) {
        await refreshScopes(scopesAfterPromote("uploaded"), { silent: true });
        onImageAssetsChanged?.();
      }
    },
    [tryInsert, refreshScopes, showNotice, onImageAssetsChanged],
  );

  const handleInsertPromoted = useCallback(
    (item: ImageGridItem) => {
      tryInsert(toImageMarkdown(item.path), "used");
    },
    [tryInsert],
  );

  const executeDelete = useCallback(
    async (item: PendingDelete, tab: Tab, force = false) => {
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
    (item: ImageGridItem, tab: Tab, referenceCount = 0) => {
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      void uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imageFiles: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (
          item.type.startsWith("image/") ||
          item.type === "video/mp4"
        ) {
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
      showNotice(
        "ai",
        `AI staging に保存しました: ${data.file.name}`,
        "success",
      );
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
          {TABS.map((tab) => (
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
          <>
            <TabNoticeBanner notice={tabNotices.used} />
            <div className={cn(PANE4_TAB_INSET, "flex flex-col gap-3 pb-3 pt-3")}>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <Select
                    value={seriesSelectValue}
                    onValueChange={(value) => {
                      if (value === FILTER_UNUSED) {
                        setUsedFilter({
                          seriesId: FILTER_SERIES_UNUSED,
                          courseId: null,
                          lessonId: null,
                        });
                        return;
                      }
                      setUsedFilter({
                        seriesId: value === FILTER_ALL ? null : value,
                        courseId: null,
                        lessonId: null,
                      });
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full text-xs">
                      <span className="truncate">{usedFilterSeriesLabel}</span>
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value={FILTER_ALL} className="text-xs">
                        すべてのシリーズ
                      </SelectItem>
                      {series.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={FILTER_UNUSED} className="text-xs">
                        （未使用）
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={usedFilter.courseId ?? FILTER_ALL}
                    onValueChange={(value) => {
                      setUsedFilter((prev) => ({
                        ...prev,
                        courseId: value === FILTER_ALL ? null : value,
                        lessonId: null,
                      }));
                    }}
                    disabled={seriesUnusedMode || !usedFilter.seriesId}
                  >
                    <SelectTrigger size="sm" className="w-full text-xs">
                      <span className="truncate">{usedFilterCourseLabel}</span>
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value={FILTER_ALL} className="text-xs">
                        すべてのコース
                      </SelectItem>
                      {filterCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={usedFilter.lessonId ?? FILTER_ALL}
                    onValueChange={(value) => {
                      setUsedFilter((prev) => ({
                        ...prev,
                        lessonId: value === FILTER_ALL ? null : value,
                      }));
                    }}
                    disabled={seriesUnusedMode || !usedFilter.courseId}
                  >
                    <SelectTrigger size="sm" className="w-full text-xs">
                      <span className="truncate">{usedFilterLessonLabel}</span>
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value={FILTER_ALL} className="text-xs">
                        すべてのレッスン
                      </SelectItem>
                      {filterLessons.map((l) => (
                        <SelectItem key={l.id} value={l.id} className="text-xs">
                          {l.lesson}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isUsedImageFilterActive(usedFilter) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-fit text-xs"
                    onClick={resetUsedFilter}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    フィルタリセット
                  </Button>
                ) : null}
              </div>
              <ImageGrid
                items={usedGridItems}
                emptyMessage="promote 済みの画像がありません"
                onPreview={openPreview}
                onInsert={handleInsertPromoted}
                onDelete={(item) => {
                  const row = usedRows.find((r) => r.path === item.path);
                  requestDelete(item, "used", row?.referenceCount ?? 0);
                }}
              />
            </div>
          </>
        ) : null}

        {activeTab === "upload" && !loading ? (
          <>
            <TabNoticeBanner notice={tabNotices.upload} />
            <div className={cn(PANE4_TAB_INSET, "flex flex-col gap-3 pb-3 pt-3")}>
              <div
                className={cn(
                  PANE4_TOP_BOX_CLASS,
                  "cursor-pointer transition-colors",
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary hover:bg-primary/5",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">
                  ドラッグ&ドロップ
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  またはクリックして選択
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4"
                multiple
                className="hidden"
                onChange={(e) =>
                  e.target.files && void uploadFiles(e.target.files)
                }
              />
              <ImageGrid
                items={stagingGridItems}
                emptyMessage="staging に画像がありません"
                onPreview={openPreview}
                onInsert={handleInsertStaging}
                onDelete={(item) => requestDelete(item, "upload")}
              />
            </div>
          </>
        ) : null}

        {activeTab === "ai" ? (
          <>
            <TabNoticeBanner notice={tabNotices.ai} />
            <div className={cn(PANE4_TAB_INSET, "flex flex-col gap-3 pb-3 pt-3")}>
            {!lesson ? (
              <p className="text-center text-xs text-muted-foreground">
                レッスンを選択してください
              </p>
            ) : (
              <>
                <div className={PANE4_PROMPT_BLOCK_CLASS}>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={3}
                    placeholder="画像生成プロンプトを入力してください"
                    className={PANE4_PROMPT_TEXTAREA_CLASS}
                  />
                  <div className={PANE4_BUTTON_ROW_CLASS}>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0 px-4 text-xs transition-colors enabled:hover:bg-primary/85"
                      disabled={generating || suggesting || !aiPrompt.trim()}
                      onClick={() => void handleGenerate()}
                    >
                      {generating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3.5 w-3.5" />
                          生成
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      disabled={!lesson || suggesting || generating}
                      onClick={() => void handleAutoFill()}
                    >
                      {suggesting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Pen className="h-3.5 w-3.5" />
                      )}
                      自動入力
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      disabled={suggesting || generating}
                      onClick={handleResetPrompt}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      リセット
                    </Button>
                  </div>
                </div>
                <ImageGrid
                  items={aiStagingGridItems}
                  emptyMessage="AI staging に画像がありません"
                  onPreview={openPreview}
                  onInsert={handleInsertAiStaging}
                  onDelete={(item) => requestDelete(item, "ai")}
                />
              </>
            )}
            </div>
          </>
        ) : null}

        {activeTab === "web" ? (
          <>
            <TabNoticeBanner notice={tabNotices.web} />
            <div className={cn(PANE4_TAB_INSET, "flex flex-col gap-3 pb-3 pt-3")}>
            {!lesson ? (
              <p className="text-center text-xs text-muted-foreground">
                レッスンを選択してください
              </p>
            ) : (
              <>
                <div className={PANE4_PROMPT_BLOCK_CLASS}>
                  <textarea
                    value={webPrompt}
                    onChange={(e) => setWebPrompt(e.target.value)}
                    rows={3}
                    placeholder="画像検索条件を入力してください"
                    className={PANE4_PROMPT_TEXTAREA_CLASS}
                  />
                  <div className={PANE4_BUTTON_ROW_CLASS}>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 shrink-0 px-4 text-xs transition-colors enabled:hover:bg-primary/85"
                      disabled={
                        searching || webSuggesting || !webPrompt.trim()
                      }
                      onClick={() => void handleSearch()}
                    >
                      {searching ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          検索中...
                        </>
                      ) : (
                        <>
                          <Search className="h-3.5 w-3.5" />
                          検索
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      disabled={!lesson || webSuggesting || searching}
                      onClick={() => void handleWebAutoFill()}
                    >
                      {webSuggesting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Pen className="h-3.5 w-3.5" />
                      )}
                      自動入力
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      disabled={webSuggesting || searching}
                      onClick={handleResetWebPrompt}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      リセット
                    </Button>
                  </div>
                </div>
                <ImageGrid
                  items={webStagingGridItems}
                  emptyMessage="Web staging に画像がありません"
                  onPreview={openPreview}
                  onInsert={handleInsertWebStaging}
                  onDelete={(item) => requestDelete(item, "web")}
                />
              </>
            )}
            </div>
          </>
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
