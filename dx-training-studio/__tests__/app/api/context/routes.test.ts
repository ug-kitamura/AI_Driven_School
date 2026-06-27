import { afterEach, describe, expect, it, vi } from "vitest";
import { DbConnectionError } from "@/lib/context-db/types";

const checkConnection = vi.fn();
const listItems = vi.fn();
const searchItems = vi.fn();

vi.mock("@/lib/context-db/repository", () => ({
  getContextRepository: () => ({
    checkConnection,
    listItems,
    searchItems,
    getItem: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    listDistinctTags: vi.fn(),
  }),
  resetContextRepositoryForTests: vi.fn(),
}));

describe("GET /api/context/db-check", () => {
  afterEach(() => {
    checkConnection.mockReset();
  });

  it("returns ok when connection succeeds", async () => {
    checkConnection.mockResolvedValue(undefined);
    const { GET } = await import("@/app/api/context/db-check/route");
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 503 when database is unavailable", async () => {
    checkConnection.mockRejectedValue(new DbConnectionError());
    const { GET } = await import("@/app/api/context/db-check/route");
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "データベースに接続できません" });
  });
});

describe("GET /api/context/items", () => {
  afterEach(() => {
    listItems.mockReset();
  });

  it("returns filtered items", async () => {
    listItems.mockResolvedValue([{ id: 1, title: "A" }]);
    const { GET } = await import("@/app/api/context/items/route");
    const response = await GET(new Request("http://localhost/api/context/items?tags=環境構築,xyz"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [{ id: 1, title: "A" }] });
    expect(listItems).toHaveBeenCalledWith(["環境構築", "xyz"]);
  });

  it("returns 400 on invalid create body", async () => {
    const { POST } = await import("@/app/api/context/items/route");
    const response = await POST(
      new Request("http://localhost/api/context/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "A", body: "B" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when tags are empty", async () => {
    const { POST } = await import("@/app/api/context/items/route");
    const response = await POST(
      new Request("http://localhost/api/context/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "A",
          body: "B",
          tags: [],
          source_url: "https://example.com",
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/context/items/search", () => {
  afterEach(() => {
    searchItems.mockReset();
  });

  it("returns search results", async () => {
    searchItems.mockResolvedValue([{ id: 1, title: "A" }]);
    const { GET } = await import("@/app/api/context/items/search/route");
    const response = await GET(
      new Request("http://localhost/api/context/items/search?q=環境"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{ id: 1, title: "A" }],
    });
    expect(searchItems).toHaveBeenCalledWith("環境");
  });

  it("returns 400 when q is missing", async () => {
    const { GET } = await import("@/app/api/context/items/search/route");
    const response = await GET(
      new Request("http://localhost/api/context/items/search"),
    );
    expect(response.status).toBe(400);
  });
});
