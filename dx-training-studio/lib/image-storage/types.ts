import type { ImageSource } from "@/lib/image-path";
import type { ImageStorageMode } from "@/lib/schema";

export type { ImageStorageMode };

export const STORAGE_CONNECTION_ERROR_MESSAGE =
  "ストレージに接続できません";

export class StorageConnectionError extends Error {
  readonly statusCode = 503;

  constructor(message = STORAGE_CONNECTION_ERROR_MESSAGE) {
    super(message);
    this.name = "StorageConnectionError";
  }
}

export type CanonicalFileEntry = {
  path: string;
  name: string;
  source: ImageSource;
  uploadedAt: string;
};

export type CanonicalBackend = {
  listCanonical(): Promise<CanonicalFileEntry[]>;
  readCanonical(logicalPath: string): Promise<Buffer | null>;
  putCanonical(
    logicalPath: string,
    data: Buffer,
    source: ImageSource,
  ): Promise<CanonicalFileEntry>;
  deleteCanonical(logicalPath: string): Promise<void>;
  existsCanonical(logicalPath: string): Promise<boolean>;
};
