import fs from "node:fs/promises";
import path from "node:path";
import {
  IMAGE_SOURCES,
  type ImageSource,
  isSafeImageLogicalPath,
  isStagingPath,
  normalizeImageLogicalPath,
  promoteTargetPath,
  sanitizeUploadFileName,
  stagingDirLogical,
} from "@/lib/image-path";

export type ImageFileEntry = {
  path: string;
  name: string;
  source: ImageSource;
  uploadedAt: string;
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export function getImagesRoot(projectRoot: string): string {
  return path.join(projectRoot, "images");
}

export function resolveAbsoluteImagePath(
  projectRoot: string,
  logicalPath: string,
): string | null {
  const normalized = normalizeImageLogicalPath(logicalPath);
  if (!isSafeImageLogicalPath(normalized)) return null;
  const absolute = path.join(projectRoot, normalized.split("/").join(path.sep));
  const root = getImagesRoot(projectRoot);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(absolute);
  if (!resolved.startsWith(resolvedRoot + path.sep) && resolved !== resolvedRoot) {
    return null;
  }
  return resolved;
}

export async function ensureImageDirectories(projectRoot: string): Promise<void> {
  for (const source of IMAGE_SOURCES) {
    await fs.mkdir(path.join(getImagesRoot(projectRoot), source, "_staging"), {
      recursive: true,
    });
    await fs.mkdir(path.join(getImagesRoot(projectRoot), source), {
      recursive: true,
    });
  }
}

async function listFilesInDir(
  dir: string,
  source: ImageSource,
  logicalPrefix: string,
): Promise<ImageFileEntry[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const result: ImageFileEntry[] = [];
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const absolute = path.join(dir, name);
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) continue;
    result.push({
      path: `${logicalPrefix}/${name}`,
      name,
      source,
      uploadedAt: stat.mtime.toISOString(),
    });
  }
  return result.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function listStagingImages(
  projectRoot: string,
  source: ImageSource,
): Promise<ImageFileEntry[]> {
  const dir = path.join(getImagesRoot(projectRoot), source, "_staging");
  return listFilesInDir(dir, source, stagingDirLogical(source));
}

export async function listPromotedImages(
  projectRoot: string,
): Promise<ImageFileEntry[]> {
  const all: ImageFileEntry[] = [];
  for (const source of IMAGE_SOURCES) {
    const dir = path.join(getImagesRoot(projectRoot), source);
    const entries = await listFilesInDir(dir, source, `images/${source}`);
    all.push(...entries);
  }
  return all.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function saveStagingImage(
  projectRoot: string,
  source: ImageSource,
  fileName: string,
  data: Buffer,
): Promise<ImageFileEntry> {
  await ensureImageDirectories(projectRoot);
  const safeName = sanitizeUploadFileName(fileName);
  const logicalPath = `${stagingDirLogical(source)}/${safeName}`;
  const absolute = resolveAbsoluteImagePath(projectRoot, logicalPath);
  if (!absolute) throw new Error("invalid path");
  await fs.writeFile(absolute, data);
  const stat = await fs.stat(absolute);
  return {
    path: logicalPath,
    name: safeName,
    source,
    uploadedAt: stat.mtime.toISOString(),
  };
}

export async function promoteStagingImage(
  projectRoot: string,
  stagingPath: string,
): Promise<ImageFileEntry> {
  const targetLogical = promoteTargetPath(stagingPath);
  if (!targetLogical) throw new Error("invalid staging path");

  const sourceAbsolute = resolveAbsoluteImagePath(projectRoot, stagingPath);
  const targetAbsolute = resolveAbsoluteImagePath(projectRoot, targetLogical);
  if (!sourceAbsolute || !targetAbsolute) throw new Error("invalid path");

  try {
    await fs.access(sourceAbsolute);
  } catch {
    throw new Error("staging file not found");
  }

  await fs.mkdir(path.dirname(targetAbsolute), { recursive: true });
  await fs.copyFile(sourceAbsolute, targetAbsolute);
  const stat = await fs.stat(targetAbsolute);
  const source = stagingPath.match(/^images\/([^/]+)\//)?.[1];
  if (source !== "uploaded" && source !== "ai" && source !== "web") {
    throw new Error("invalid source");
  }

  return {
    path: targetLogical,
    name: path.basename(targetLogical),
    source,
    uploadedAt: stat.mtime.toISOString(),
  };
}

export async function deleteImageFile(
  projectRoot: string,
  logicalPath: string,
): Promise<void> {
  const absolute = resolveAbsoluteImagePath(projectRoot, logicalPath);
  if (!absolute) throw new Error("invalid path");
  if (!isStagingPath(logicalPath) && !isSafeImageLogicalPath(logicalPath)) {
    throw new Error("invalid path");
  }
  try {
    await fs.unlink(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("file not found");
    }
    throw error;
  }
}

export async function imageFileExists(
  projectRoot: string,
  logicalPath: string,
): Promise<boolean> {
  const absolute = resolveAbsoluteImagePath(projectRoot, logicalPath);
  if (!absolute) return false;
  try {
    await fs.access(absolute);
    return true;
  } catch {
    return false;
  }
}

export function mimeTypeForPath(logicalPath: string): string {
  const ext = path.extname(logicalPath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
