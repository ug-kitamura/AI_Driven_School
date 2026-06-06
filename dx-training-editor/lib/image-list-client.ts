import type { ImageAsset } from "@/lib/schema";

/** Pane4 タブごとの画像リスト API スコープ */
export type ImageListScope = "used" | "uploaded" | "ai" | "web";

export function imageListScopeUrl(scope: ImageListScope): string {
  switch (scope) {
    case "used":
      return "/api/images/list?scope=used";
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
  const json: { files?: ImageAsset[] } = await res.json();
  if (!res.ok) return [];
  return json.files ?? [];
}

/** promote 後: staging ソースと used の両方を更新する */
export function scopesAfterPromote(stagingScope: Exclude<ImageListScope, "used">): ImageListScope[] {
  return [stagingScope, "used"];
}
