import type { ContextItem } from "@/lib/context-db/types";
import type { CreateDraftToolSession } from "@/lib/agent/tools/create-draft-session";
import type { CompactContextItem } from "@/lib/agent/tools/search-company-context";

export type SelectCompanyContextInput = {
  selection: number[] | "all" | "none";
};

export type SelectCompanyContextResult = {
  items: CompactContextItem[];
  error?: string;
};

export type SelectToolDisplay = {
  summary: string;
  display: string;
  tags: string[];
};

export function parseSelectionInput(raw: unknown): SelectCompanyContextInput["selection"] | null {
  if (raw === "all" || raw === "none") return raw;
  if (Array.isArray(raw)) {
    const numbers = raw
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 1);
    if (numbers.length === 0) return null;
    return [...new Set(numbers)];
  }
  return null;
}

function toCompactSelectedItem(item: ContextItem, index: number): CompactContextItem {
  return {
    i: index + 1,
    title: item.title,
    url: item.source_url,
    tags: item.tags,
    updated: item.source_last_updated_at,
    body: item.body,
  };
}

export function applySelection(
  items: ContextItem[],
  selection: SelectCompanyContextInput["selection"],
): ContextItem[] {
  if (selection === "none") return [];
  if (selection === "all") return [...items];
  return selection
    .map((index) => items[index - 1])
    .filter((item): item is ContextItem => item !== undefined);
}

export function formatSelectionLabel(selection: SelectCompanyContextInput["selection"]): string {
  if (selection === "all") return "all";
  if (selection === "none") return "none";
  return selection.join(",");
}

export function executeSelectCompanyContext(
  input: SelectCompanyContextInput,
  session: CreateDraftToolSession,
): { result: SelectCompanyContextResult; display: SelectToolDisplay } {
  const selection = parseSelectionInput(input.selection);
  if (selection === null) {
    return {
      result: { items: [], error: "selection が不正です" },
      display: { summary: "error", display: "✗ select: invalid", tags: [] },
    };
  }

  if (session.lastSearchResults.length === 0) {
    return {
      result: { items: [], error: "先に search_company_context を実行してください" },
      display: {
        summary: "0件",
        display: "✗ select: no prior search",
        tags: [],
      },
    };
  }

  const selected = applySelection(session.lastSearchResults, selection);
  const compact = selected.map((item) => {
    const originalIndex = session.lastSearchResults.indexOf(item);
    return toCompactSelectedItem(item, originalIndex);
  });
  const tags = selected.flatMap((item) => item.tags);

  return {
    result: { items: compact },
    display: {
      summary: `${compact.length}件`,
      display: `✓ select: ${formatSelectionLabel(selection)}`,
      tags,
    },
  };
}

export const SELECT_COMPANY_CONTEXT_SCHEMA = {
  name: "select_company_context",
  description:
    "直前の search_company_context 結果から参照 item を確定する。選択 item のみ body 付きで返す。",
  input_schema: {
    type: "object",
    properties: {
      selection: {
        description: "1 始まりの番号配列、または all / none",
        oneOf: [
          { type: "array", items: { type: "integer" } },
          { type: "string", enum: ["all", "none"] },
        ],
      },
    },
    required: ["selection"],
  },
} as const;
