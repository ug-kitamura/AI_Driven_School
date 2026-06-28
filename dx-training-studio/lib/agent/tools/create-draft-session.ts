import type { ContextItem } from "@/lib/context-db/types";

/** Server-side mutable state for create-draft tools within one invoke loop. */
export type CreateDraftToolSession = {
  lastSearchResults: ContextItem[];
};

export function createCreateDraftToolSession(): CreateDraftToolSession {
  return { lastSearchResults: [] };
}
