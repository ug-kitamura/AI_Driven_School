import fs from "node:fs/promises";
import { head } from "@vercel/blob";
import {
  moveImageToTrash,
  mimeTypeForPath,
  resolveAbsoluteImagePath,
} from "@/lib/image-store";
import {
  formatImageFileEtag,
  imageFileResponse,
  matchesIfNoneMatch,
  imageFileNotModifiedResponse,
} from "@/lib/image-file-response";
import {
  parseImageStorageMode,
  resolveCanonicalBackend,
  storageErrorResponse,
} from "@/lib/image-storage/resolve";
import { StorageConnectionError } from "@/lib/image-storage/types";
import {
  isCanonicalImagePath,
  isSafeImageLogicalPath,
  isStagingPath,
} from "@/lib/image-path";

async function respondLocalImageFile(
  req: Request,
  absolutePath: string,
  logicalPath: string,
): Promise<Response> {
  const stat = await fs.stat(absolutePath);
  const etag = formatImageFileEtag(stat.mtimeMs, stat.size);
  const lastModified = stat.mtime;
  if (matchesIfNoneMatch(req, etag)) {
    return imageFileNotModifiedResponse(etag, lastModified);
  }
  const data = await fs.readFile(absolutePath);
  return imageFileResponse(req, data, mimeTypeForPath(logicalPath), etag, lastModified);
}

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
      return await respondLocalImageFile(req, absolute, pathParam);
    } catch {
      return Response.json({ error: "ファイルが見つかりません" }, { status: 404 });
    }
  }

  if (!isCanonicalImagePath(pathParam)) {
    return Response.json({ error: "path が不正です" }, { status: 400 });
  }

  const storageMode = parseImageStorageMode(url.searchParams.get("storageMode"));

  try {
    if (storageMode === "local") {
      const absolute = resolveAbsoluteImagePath(process.cwd(), pathParam);
      if (!absolute) {
        return Response.json({ error: "path が不正です" }, { status: 400 });
      }
      try {
        return await respondLocalImageFile(req, absolute, pathParam);
      } catch {
        return Response.json({ error: "ファイルが見つかりません" }, { status: 404 });
      }
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) {
      const storageResponse = storageErrorResponse(new StorageConnectionError());
      if (storageResponse) return storageResponse;
      return Response.json({ error: "ストレージに接続できません" }, { status: 503 });
    }

    let blobMeta: Awaited<ReturnType<typeof head>>;
    try {
      blobMeta = await head(pathParam, { token });
    } catch {
      return Response.json({ error: "ファイルが見つかりません" }, { status: 404 });
    }

    const etag = formatImageFileEtag(
      blobMeta.uploadedAt.getTime(),
      blobMeta.size,
    );
    const lastModified = blobMeta.uploadedAt;
    if (matchesIfNoneMatch(req, etag)) {
      return imageFileNotModifiedResponse(etag, lastModified);
    }

    const backend = resolveCanonicalBackend(process.cwd(), storageMode);
    const data = await backend.readCanonical(pathParam);
    if (!data) {
      return Response.json({ error: "ファイルが見つかりません" }, { status: 404 });
    }
    return imageFileResponse(
      req,
      data,
      mimeTypeForPath(pathParam),
      etag,
      lastModified,
    );
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
