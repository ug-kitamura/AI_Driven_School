import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ContextItem } from "@/lib/context-db/types";

export const LOCAL_DB_DIR = "local-db";
export const CONTEXT_META_FILE = "context-meta.json";
export const CONTEXT_ITEMS_DIR = "context-items";

export type ContextMeta = {
  nextId: number;
};

const contextMetaSchema = z.object({
  nextId: z.number().int().min(1),
});

export const contextItemFileSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  source_url: z.string(),
  source_last_updated_at: z.string().nullable(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function getLocalDbRoot(projectRoot: string): string {
  return path.join(projectRoot, LOCAL_DB_DIR);
}

export function getMetaPath(projectRoot: string): string {
  return path.join(getLocalDbRoot(projectRoot), CONTEXT_META_FILE);
}

export function getItemsDir(projectRoot: string): string {
  return path.join(getLocalDbRoot(projectRoot), CONTEXT_ITEMS_DIR);
}

export function getItemPath(projectRoot: string, id: number): string {
  return path.join(getItemsDir(projectRoot), `${id}.json`);
}

export async function atomicWriteJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
}

export async function ensureLocalContextStore(projectRoot: string): Promise<void> {
  await fs.mkdir(getItemsDir(projectRoot), { recursive: true });
  const metaPath = getMetaPath(projectRoot);
  try {
    await fs.access(metaPath);
  } catch {
    await atomicWriteJson(metaPath, { nextId: 1 } satisfies ContextMeta);
  }
}

export async function readMeta(projectRoot: string): Promise<ContextMeta> {
  await ensureLocalContextStore(projectRoot);
  const raw = await fs.readFile(getMetaPath(projectRoot), "utf8");
  return contextMetaSchema.parse(JSON.parse(raw));
}

export async function writeMeta(
  projectRoot: string,
  meta: ContextMeta,
): Promise<void> {
  await atomicWriteJson(getMetaPath(projectRoot), meta);
}

export async function readItemFile(
  projectRoot: string,
  id: number,
): Promise<ContextItem | null> {
  const filePath = getItemPath(projectRoot, id);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return contextItemFileSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeItemFile(
  projectRoot: string,
  item: ContextItem,
): Promise<void> {
  await atomicWriteJson(getItemPath(projectRoot, item.id), item);
}

export async function listItemIds(projectRoot: string): Promise<number[]> {
  await ensureLocalContextStore(projectRoot);
  const entries = await fs.readdir(getItemsDir(projectRoot));
  return entries
    .filter((name) => name.endsWith(".json"))
    .map((name) => Number.parseInt(name.replace(/\.json$/, ""), 10))
    .filter((id) => Number.isFinite(id) && id > 0)
    .sort((a, b) => a - b);
}

export async function readAllItems(projectRoot: string): Promise<ContextItem[]> {
  const ids = await listItemIds(projectRoot);
  const items: ContextItem[] = [];
  for (const id of ids) {
    try {
      const item = await readItemFile(projectRoot, id);
      if (item) items.push(item);
    } catch {
      // skip invalid files in bulk reads
    }
  }
  return items;
}

export function sortItems(items: ContextItem[]): ContextItem[] {
  return [...items].sort((a, b) => {
    const updatedDiff =
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    if (updatedDiff !== 0) return updatedDiff;
    return b.id - a.id;
  });
}
