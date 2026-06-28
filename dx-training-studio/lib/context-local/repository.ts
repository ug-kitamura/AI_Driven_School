import fs from "node:fs/promises";
import os from "node:os";
import { tokenizeSearchQuery } from "@/lib/context-search";
import type {
  ContextItem,
  CreateContextItemInput,
  UpdateContextItemInput,
} from "@/lib/context-db/types";
import {
  getItemPath,
  readAllItems,
  readItemFile,
  readMeta,
  sortItems,
  writeItemFile,
  writeMeta,
} from "@/lib/context-local/store";

function getCurrentUsername(): string | null {
  try {
    const username = os.userInfo().username?.trim();
    return username || null;
  } catch {
    return null;
  }
}

function matchesTagsFilter(item: ContextItem, tags: string[]): boolean {
  return tags.some((tag) => item.tags.includes(tag));
}

function matchesSearch(item: ContextItem, query: string): boolean {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return false;
  const title = item.title.toLowerCase();
  const body = item.body.toLowerCase();
  const tagsText = item.tags.join(" ").toLowerCase();
  return tokens.some(
    (token) =>
      title.includes(token.toLowerCase()) ||
      body.includes(token.toLowerCase()) ||
      tagsText.includes(token.toLowerCase()),
  );
}

export function createContextLocalRepository(projectRoot: string) {
  return {
    async checkConnection(): Promise<void> {
      // local mode does not require DATABASE_URL
    },

    async listItems(tags?: string[]): Promise<ContextItem[]> {
      const items = await readAllItems(projectRoot);
      const filtered =
        tags && tags.length > 0
          ? items.filter((item) => matchesTagsFilter(item, tags))
          : items;
      return sortItems(filtered);
    },

    async getItem(id: number): Promise<ContextItem | null> {
      return readItemFile(projectRoot, id);
    },

    async createItem(input: CreateContextItemInput): Promise<ContextItem> {
      const meta = await readMeta(projectRoot);
      const id = meta.nextId;
      const username = getCurrentUsername();
      const now = new Date().toISOString();
      const item: ContextItem = {
        id,
        title: input.title,
        body: input.body,
        tags: input.tags,
        source_url: input.source_url,
        source_last_updated_at: input.source_last_updated_at ?? null,
        created_by: username,
        updated_by: username,
        created_at: now,
        updated_at: now,
      };
      await writeItemFile(projectRoot, item);
      await writeMeta(projectRoot, { nextId: id + 1 });
      return item;
    },

    async updateItem(
      id: number,
      input: UpdateContextItemInput,
    ): Promise<ContextItem | null> {
      const existing = await readItemFile(projectRoot, id);
      if (!existing) return null;

      const username = getCurrentUsername();
      const item: ContextItem = {
        ...existing,
        title: input.title ?? existing.title,
        body: input.body ?? existing.body,
        tags: input.tags ?? existing.tags,
        source_url: input.source_url ?? existing.source_url,
        source_last_updated_at:
          input.source_last_updated_at !== undefined
            ? input.source_last_updated_at
            : existing.source_last_updated_at,
        updated_by: username,
        updated_at: new Date().toISOString(),
      };
      await writeItemFile(projectRoot, item);
      return item;
    },

    async deleteItem(id: number): Promise<boolean> {
      const filePath = getItemPath(projectRoot, id);
      try {
        await fs.unlink(filePath);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return false;
        }
        throw error;
      }
    },

    async listDistinctTags(): Promise<string[]> {
      const items = await readAllItems(projectRoot);
      const tagSet = new Set<string>();
      for (const item of items) {
        for (const tag of item.tags) {
          tagSet.add(tag);
        }
      }
      return [...tagSet].sort((a, b) => a.localeCompare(b, "ja"));
    },

    async searchItems(query: string): Promise<ContextItem[]> {
      const tokens = tokenizeSearchQuery(query);
      if (tokens.length === 0) return [];
      const items = await readAllItems(projectRoot);
      return sortItems(items.filter((item) => matchesSearch(item, query)));
    },
  };
}
