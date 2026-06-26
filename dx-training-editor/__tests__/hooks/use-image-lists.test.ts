import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useImageLists } from "@/components/workspace/image-manager/use-image-lists";

describe("useImageLists", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches only active tab scope when pane4 opens", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useImageLists({ pane4Open: true, activeTab: "used" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/images/list?scope=used&storageMode=storage");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches staging uploaded scope for upload tab", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useImageLists({ pane4Open: true, activeTab: "upload" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/images/list?scope=staging&source=uploaded",
      );
    });
  });

  it("refetches when activeTab changes", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = renderHook(
      ({ activeTab }: { activeTab: "used" | "ai" }) =>
        useImageLists({ pane4Open: true, activeTab }),
      { initialProps: { activeTab: "used" as const } },
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    rerender({ activeTab: "ai" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/images/list?scope=staging&source=ai",
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fetch when pane4 is closed", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useImageLists({ pane4Open: false, activeTab: "used" }));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
