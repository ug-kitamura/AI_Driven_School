import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchImageList,
  imageListScopeUrl,
  scopesAfterPromote,
} from "@/lib/image-list-client";

describe("image-list-client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps scopes to list API URLs", () => {
    expect(imageListScopeUrl("used")).toBe("/api/images/list?scope=used&storageMode=storage");
    expect(imageListScopeUrl("uploaded")).toBe(
      "/api/images/list?scope=staging&source=uploaded",
    );
    expect(imageListScopeUrl("ai")).toBe("/api/images/list?scope=staging&source=ai");
    expect(imageListScopeUrl("web")).toBe("/api/images/list?scope=staging&source=web");
  });

  it("fetchImageList returns files on success", async () => {
    const files = [{ path: "images/a.png", name: "a.png" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ files }),
      })),
    );

    await expect(fetchImageList("used")).resolves.toEqual(files);
    expect(fetch).toHaveBeenCalledWith("/api/images/list?scope=used&storageMode=storage");
  });

  it("fetchImageList returns empty array on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "fail" }),
      })),
    );

    await expect(fetchImageList("ai")).resolves.toEqual([]);
  });

  it("scopesAfterPromote includes staging source and used", () => {
    expect(scopesAfterPromote("uploaded")).toEqual(["uploaded", "used"]);
    expect(scopesAfterPromote("ai")).toEqual(["ai", "used"]);
    expect(scopesAfterPromote("web")).toEqual(["web", "used"]);
  });
});
