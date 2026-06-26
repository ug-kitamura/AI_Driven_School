import { listStagingImages } from "@/lib/image-store";
import {
  parseImageStorageMode,
  resolveCanonicalBackend,
  storageErrorResponse,
} from "@/lib/image-storage/resolve";
import { isImageSource } from "@/lib/image-path";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "staging";
  const sourceRaw = url.searchParams.get("source") ?? "uploaded";
  const storageMode = parseImageStorageMode(url.searchParams.get("storageMode"));

  try {
    if (scope === "staging") {
      if (!isImageSource(sourceRaw)) {
        return Response.json({ error: "source が不正です" }, { status: 400 });
      }
      const files = await listStagingImages(process.cwd(), sourceRaw);
      return Response.json({ files });
    }

    if (scope === "used") {
      const backend = resolveCanonicalBackend(process.cwd(), storageMode);
      const files = await backend.listCanonical();
      return Response.json({ files });
    }

    return Response.json({ error: "scope が不正です" }, { status: 400 });
  } catch (error) {
    const storageResponse = storageErrorResponse(error);
    if (storageResponse) return storageResponse;

    return Response.json(
      { error: error instanceof Error ? error.message : "一覧取得に失敗しました" },
      { status: 500 },
    );
  }
}
