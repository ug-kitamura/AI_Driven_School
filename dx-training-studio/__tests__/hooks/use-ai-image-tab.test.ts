import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiImageTab } from "@/components/workspace/image-manager/use-ai-image-tab";
import type { Lesson } from "@/lib/schema";

const lesson = { id: "l1", lesson: "Test", content: "" } as Lesson;

describe("useAiImageTab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls refreshScope after successful generate", async () => {
    const refreshScope = vi.fn(async () => undefined);
    const showNotice = vi.fn();
    const clearNotice = vi.fn();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          file: { path: "/staging/ai/a.png", name: "a.png" },
          alt: "alt text",
        }),
      })),
    );

    const { result } = renderHook(() =>
      useAiImageTab({
        lesson,
        editorCommentPrompt: null,
        editorCursorOffset: null,
        refreshScope,
        showNotice,
        clearNotice,
      }),
    );

    act(() => {
      result.current.setPrompt("draw a cat");
    });

    await act(async () => {
      await result.current.handleGenerate();
    });

    await waitFor(() => {
      expect(refreshScope).toHaveBeenCalledWith("ai", { silent: true });
    });
    expect(showNotice).toHaveBeenCalledWith(
      "ai",
      expect.stringContaining("AI staging"),
      "success",
    );
  });
});
