import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createContextLocalRepository } from "@/lib/context-local/repository";
import {
  getItemPath,
  getMetaPath,
  readMeta,
} from "@/lib/context-local/store";

describe("context-local repository", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  async function createTempRepo() {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "context-local-"));
    return createContextLocalRepository(tempDir);
  }

  it("creates store on first create", async () => {
    const repo = await createTempRepo();
    const item = await repo.createItem({
      title: "環境構築",
      body: "手順",
      tags: ["環境構築"],
      source_url: "https://example.com",
    });

    expect(item.id).toBe(1);
    await expect(readMeta(tempDir)).resolves.toEqual({ nextId: 2 });
    await expect(
      fs.readFile(getItemPath(tempDir, 1), "utf8"),
    ).resolves.toContain("環境構築");
  });

  it("lists items with OR tag filter", async () => {
    const repo = await createTempRepo();
    await repo.createItem({
      title: "A",
      body: "body-a",
      tags: ["環境構築"],
      source_url: "https://a.example",
    });
    await repo.createItem({
      title: "B",
      body: "body-b",
      tags: ["セキュリティ"],
      source_url: "https://b.example",
    });

    const items = await repo.listItems(["環境構築", "セキュリティ"]);
    expect(items).toHaveLength(2);
  });

  it("updates item without renaming file", async () => {
    const repo = await createTempRepo();
    const created = await repo.createItem({
      title: "旧タイトル",
      body: "body",
      tags: ["git"],
      source_url: "https://example.com",
    });

    const updated = await repo.updateItem(created.id, { title: "新タイトル" });
    expect(updated?.title).toBe("新タイトル");
    await expect(fs.access(getItemPath(tempDir, created.id))).resolves.toBeUndefined();
  });

  it("deletes item file", async () => {
    const repo = await createTempRepo();
    const created = await repo.createItem({
      title: "削除対象",
      body: "body",
      tags: ["git"],
      source_url: "https://example.com",
    });

    await expect(repo.deleteItem(created.id)).resolves.toBe(true);
    await expect(fs.access(getItemPath(tempDir, created.id))).rejects.toThrow();
  });

  it("searches title, body, and tags", async () => {
    const repo = await createTempRepo();
    await repo.createItem({
      title: "開発環境",
      body: "Git インストール",
      tags: ["git"],
      source_url: "https://example.com",
    });

    const byTitle = await repo.searchItems("開発");
    const byBody = await repo.searchItems("インストール");
    const byTag = await repo.searchItems("git");

    expect(byTitle).toHaveLength(1);
    expect(byBody).toHaveLength(1);
    expect(byTag).toHaveLength(1);
  });

  it("returns distinct tags sorted", async () => {
    const repo = await createTempRepo();
    await repo.createItem({
      title: "A",
      body: "a",
      tags: ["xyz", "環境構築"],
      source_url: "https://a.example",
    });
    await repo.createItem({
      title: "B",
      body: "b",
      tags: ["環境構築"],
      source_url: "https://b.example",
    });

    await expect(repo.listDistinctTags()).resolves.toEqual(["xyz", "環境構築"]);
  });

  it("initializes meta file path under local-db", async () => {
    const repo = await createTempRepo();
    await repo.listItems();
    await expect(fs.access(getMetaPath(tempDir))).resolves.toBeUndefined();
  });
});
