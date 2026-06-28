import { beforeEach, describe, expect, it, vi } from "vitest";
import { DbConnectionError } from "@/lib/context-db/types";
import { createCreateDraftToolSession } from "@/lib/agent/tools/create-draft-session";
import {
  executeSearchCompanyContext,
  toCompactSearchItems,
} from "@/lib/agent/tools/search-company-context";
import {
  applySelection,
  executeSelectCompanyContext,
  parseSelectionInput,
} from "@/lib/agent/tools/select-company-context";
import { executeRegisteredTool } from "@/lib/agent/tools/registry";

vi.mock("@/lib/context-resolve", () => ({
  getContextRepository: vi.fn(),
}));

import { getContextRepository } from "@/lib/context-resolve";

describe("search-company-context", () => {
  beforeEach(() => {
    vi.mocked(getContextRepository).mockReset();
  });

  it("returns compact items without body", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      searchItems: vi.fn().mockResolvedValue([
        {
          id: 1,
          title: "ブランチ",
          body: "secret body",
          tags: ["git"],
          source_url: "https://example.com",
          source_last_updated_at: "2026-01-01",
          created_by: null,
          updated_by: null,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
      ]),
    } as never);

    const session = createCreateDraftToolSession();
    const outcome = await executeSearchCompanyContext({ query: "ブランチ" }, session);

    expect(outcome.result.items).toHaveLength(1);
    expect(outcome.result.items?.[0]?.body).toBe("");
    expect(outcome.display.display).toBe("🔍 search: ブランチ → 1件");
    expect(session.lastSearchResults).toHaveLength(1);
  });

  it("returns db error in tool result", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      searchItems: vi.fn().mockRejectedValue(new DbConnectionError()),
    } as never);

    const session = createCreateDraftToolSession();
    const outcome = await executeSearchCompanyContext({ query: "test" }, session);

    expect(outcome.result.error).toBeTruthy();
    expect(outcome.result.items).toEqual([]);
  });
});

describe("select-company-context", () => {
  it("parses selection input", () => {
    expect(parseSelectionInput([1, 3])).toEqual([1, 3]);
    expect(parseSelectionInput("all")).toBe("all");
    expect(parseSelectionInput("none")).toBe("none");
  });

  it("returns body for selected items only", () => {
    const session = createCreateDraftToolSession();
    session.lastSearchResults = [
      {
        id: 1,
        title: "A",
        body: "body-a",
        tags: ["a"],
        source_url: "https://a",
        source_last_updated_at: null,
        created_by: null,
        updated_by: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      {
        id: 2,
        title: "B",
        body: "body-b",
        tags: ["b"],
        source_url: "https://b",
        source_last_updated_at: null,
        created_by: null,
        updated_by: null,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
    ];

    const outcome = executeSelectCompanyContext({ selection: [2] }, session);
    expect(outcome.result.items).toHaveLength(1);
    expect(outcome.result.items[0]?.body).toBe("body-b");
    expect(outcome.display.tags).toEqual(["b"]);
  });

  it("applySelection filters indices", () => {
    const items = [{ title: "A" }, { title: "B" }] as never;
    expect(applySelection(items, [2])).toEqual([{ title: "B" }]);
  });
});

describe("tool registry", () => {
  it("executes registered tools", async () => {
    vi.mocked(getContextRepository).mockReturnValue({
      searchItems: vi.fn().mockResolvedValue([]),
    } as never);

    const session = createCreateDraftToolSession();
    const outcome = await executeRegisteredTool(
      "search_company_context",
      { query: "git" },
      session,
      "local",
    );
    expect(outcome.display.summary).toBe("0件");
  });
});

describe("toCompactSearchItems", () => {
  it("assigns 1-based index", () => {
    expect(
      toCompactSearchItems([
        {
          title: "A",
          source_url: "https://a",
          tags: [],
          source_last_updated_at: null,
        },
      ]),
    ).toEqual([
      {
        i: 1,
        title: "A",
        url: "https://a",
        tags: [],
        updated: null,
        body: "",
      },
    ]);
  });
});
