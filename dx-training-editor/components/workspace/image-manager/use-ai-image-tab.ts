"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImageGridItem } from "@/components/workspace/ImageGrid";
import {
  AI_KEY_ERROR,
} from "@/components/workspace/image-manager/image-manager-constants";
import { aiRequestHeaders } from "@/components/workspace/image-manager/image-manager-utils";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";
import type { ImageAsset, Lesson } from "@/lib/schema";

type RefreshScope = (
  scope: "ai",
  options?: { silent?: boolean },
) => Promise<void>;

export function useAiImageTab(options: {
  lesson: Lesson | undefined;
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  refreshScope: RefreshScope;
  showNotice: (tab: "ai", message: string, tone: "error" | "success") => void;
  clearNotice: (tab: "ai") => void;
}) {
  const {
    lesson,
    editorCommentPrompt,
    editorCursorOffset,
    refreshScope,
    showNotice,
    clearNotice,
  } = options;

  const [prompt, setPrompt] = useState("");
  const [stagingAlts, setStagingAlts] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (editorCommentPrompt !== null) {
      setPrompt(editorCommentPrompt);
    }
  }, [editorCommentPrompt]);

  const resolveAlt = useCallback(
    (item: ImageGridItem) => stagingAlts[item.path] ?? stagingAlts[item.name],
    [stagingAlts],
  );

  const handleGenerate = useCallback(async () => {
    if (!lesson) return;
    const trimmed = prompt.trim();
    if (!trimmed) {
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
        body: JSON.stringify({ lesson, prompt: trimmed }),
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
        setStagingAlts((prev) => ({
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
  }, [lesson, prompt, refreshScope, showNotice, clearNotice]);

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
      setPrompt(data.prompt);
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
    setPrompt("");
    clearNotice("ai");
  }, [clearNotice]);

  return {
    prompt,
    setPrompt,
    generating,
    suggesting,
    stagingAlts,
    resolveAlt,
    handleGenerate,
    handleAutoFill,
    handleResetPrompt,
  };
}
