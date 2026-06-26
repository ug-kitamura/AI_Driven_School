import fs from "node:fs/promises";
import {
  moveImageToTrash,
  mimeTypeForPath,
  resolveAbsoluteImagePath,
} from "@/lib/image-store";
import {
  parseImageStorageMode,
  resolveCanonicalBackend,
  storageErrorResponse,
} from "@/lib/image-storage/resolve";
import {
  isCanonicalImagePath,
  isSafeImageLogicalPath,
  isStagingPath,
} from "@/lib/image-path";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pathParam = url.searchParams.get("path");
  if (!pathParam || !isSafeImageLogicalPath(pathParam)) {
    return Response.json({ error: "path が不正です" }, { status: 400 });
  }

  if (isStagingPath(pathParam)) {
    const absolute = resolveAbsoluteImagePath(process.cwd(), pathParam);
    if (!absolute) {
      return Response.json({ error: "path が不正です" }, { status: 400 });
    }
    try {
      const data = await fs.readFile(absolute);
      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": mimeTypeForPath(pathParam),
          "Cache-Control": "private, no-cache, must-revalidate",
        },
      });
    } catch {
      return Response.json({ error: "ファイルが見つかりません" }, { status: 404 });
    }
  }

  if (!isCanonicalImagePath(pathParam)) {
    return Response.json({ error: "path が不正です" }, { status: 400 });
  }

  const storageMode = parseImageStorageMode(url.searchParams.get("storageMode"));

  try {
    const backend = resolveCanonicalBackend(process.cwd(), storageMode);
    const data = await backend.readCanonical(pathParam);
    if (!data) {
      return Response.json({ error: "ファイルが見つかりません" }, { status: 404 });
    }
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeTypeForPath(pathParam),
        "Cache-Control": "private, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const storageResponse = storageErrorResponse(error);
    if (storageResponse) return storageResponse;

    return Response.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const pathParam = url.searchParams.get("path");
  const force = url.searchParams.get("force") === "1";

  if (!pathParam || !isSafeImageLogicalPath(pathParam)) {
    return Response.json({ error: "path が不正です" }, { status: 400 });
  }

  if (isStagingPath(pathParam)) {
    try {
      await moveImageToTrash(process.cwd(), pathParam);
      return Response.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "削除に失敗しました";
      return Response.json({ error: message }, { status: 404 });
    }
  }

  if (!isCanonicalImagePath(pathParam)) {
    return Response.json({ error: "path が不正です" }, { status: 400 });
  }

  const referenceCount = Number(url.searchParams.get("referenceCount") ?? "0");
  if (referenceCount > 0 && !force) {
    return Response.json(
      { error: "参照中の画像です。確認後 force=1 で削除してください" },
      { status: 409 },
    );
  }

  const storageMode = parseImageStorageMode(url.searchParams.get("storageMode"));

  try {
    const backend = resolveCanonicalBackend(process.cwd(), storageMode);
    await backend.deleteCanonical(pathParam);
    return Response.json({ ok: true });
  } catch (error) {
    const storageResponse = storageErrorResponse(error);
    if (storageResponse) return storageResponse;

    const message = error instanceof Error ? error.message : "削除に失敗しました";
    const status = message.includes("not found") ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
