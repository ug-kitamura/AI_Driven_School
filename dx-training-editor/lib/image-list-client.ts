import type { ImageAsset } from "@/lib/schema";
import { getImageStorageMode } from "@/lib/image-api-client";

/** Pane4 タブごとの画像リスト API スコープ */
export type ImageListScope = "used" | "uploaded" | "ai" | "web";

export function imageListScopeUrl(scope: ImageListScope): string {
  switch (scope) {
    case "used": {
      const storageMode = getImageStorageMode();
      return `/api/images/list?scope=used&storageMode=${encodeURIComponent(storageMode)}`;
    }
    case "uploaded":
      return "/api/images/list?scope=staging&source=uploaded";
    case "ai":
      return "/api/images/list?scope=staging&source=ai";
    case "web":
      return "/api/images/list?scope=staging&source=web";
  }
}

export async function fetchImageList(scope: ImageListScope): Promise<ImageAsset[]> {
  const res = await fetch(imageListScopeUrl(scope));
  const json: { files?: ImageAsset[]; error?: string } = await res.json();
  if (!res.ok) return [];
  return json.files ?? [];
}

/** promote 後: staging ソースと used の両方を更新する */
export function scopesAfterPromote(stagingScope: Exclude<ImageListScope, "used">): ImageListScope[] {
  return [stagingScope, "used"];
}
