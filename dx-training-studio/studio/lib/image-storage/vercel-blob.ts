import { del, get, list, put } from "@vercel/blob";
import {
  imageFileName,
  isCanonicalImagePath,
  type ImageSource,
} from "@/lib/image-path";
import type { CanonicalBackend } from "@/lib/image-storage/types";

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export function createVercelBlobCanonicalBackend(token: string): CanonicalBackend {
  return {
    async listCanonical() {
      const { blobs } = await list({ prefix: "images/", token });
      const result = [];
      for (const blob of blobs) {
        const pathname = blob.pathname;
        if (!isCanonicalImagePath(pathname)) continue;
        result.push({
          path: pathname,
          name: imageFileName(pathname),
          source: "uploaded" as ImageSource,
          uploadedAt: blob.uploadedAt.toISOString(),
        });
      }
      return result.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    },

    async readCanonical(logicalPath) {
      try {
        const result = await get(logicalPath, { access: "private", token });
        if (!result || result.statusCode !== 200 || !result.stream) return null;
        return streamToBuffer(result.stream);
      } catch {
        return null;
      }
    },

    async putCanonical(logicalPath, data, source: ImageSource) {
      await put(logicalPath, data, {
        access: "private",
        token,
        allowOverwrite: true,
      });
      return {
        path: logicalPath,
        name: imageFileName(logicalPath),
        source,
        uploadedAt: new Date().toISOString(),
      };
    },

    async deleteCanonical(logicalPath) {
      await del(logicalPath, { token });
    },

    async existsCanonical(logicalPath) {
      try {
        const result = await get(logicalPath, { access: "private", token });
        return Boolean(result);
      } catch {
        return false;
      }
    },
  };
}
