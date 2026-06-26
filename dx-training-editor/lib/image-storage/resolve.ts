import { imageStorageModeSchema, type ImageStorageMode } from "@/lib/schema";
import { createLocalCanonicalBackend } from "@/lib/image-storage/local";
import {
  StorageConnectionError,
  type CanonicalBackend,
} from "@/lib/image-storage/types";
import { createVercelBlobCanonicalBackend } from "@/lib/image-storage/vercel-blob";

export function parseImageStorageMode(
  raw: string | null | undefined,
): ImageStorageMode {
  const parsed = imageStorageModeSchema.safeParse(raw ?? "storage");
  return parsed.success ? parsed.data : "storage";
}

export function resolveCanonicalBackend(
  projectRoot: string,
  storageMode: ImageStorageMode,
): CanonicalBackend {
  if (storageMode === "local") {
    return createLocalCanonicalBackend(projectRoot);
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new StorageConnectionError();
  }

  return createVercelBlobCanonicalBackend(token);
}

export function storageErrorResponse(error: unknown): Response | null {
  if (error instanceof StorageConnectionError) {
    return Response.json({ error: error.message }, { status: error.statusCode });
  }
  return null;
}
