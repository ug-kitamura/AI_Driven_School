import type { ContextStorageMode } from "@/lib/schema";
import type { ToolDefinition } from "@/lib/agent/llm/types";
import type { CreateDraftToolSession } from "@/lib/agent/tools/create-draft-session";
import {
  executeSearchCompanyContext,
  SEARCH_COMPANY_CONTEXT_SCHEMA,
  type SearchCompanyContextInput,
} from "@/lib/agent/tools/search-company-context";
import {
  executeSelectCompanyContext,
  SELECT_COMPANY_CONTEXT_SCHEMA,
  type SelectCompanyContextInput,
} from "@/lib/agent/tools/select-company-context";

export type ToolExecutionDisplay = {
  summary: string;
  display: string;
  tags?: string[];
};

export type ToolExecutionOutcome = {
  result: unknown;
  display: ToolExecutionDisplay;
};

const TOOL_SCHEMAS = {
  search_company_context: SEARCH_COMPANY_CONTEXT_SCHEMA,
  select_company_context: SELECT_COMPANY_CONTEXT_SCHEMA,
} as const;

export type RegisteredToolName = keyof typeof TOOL_SCHEMAS;

export function isRegisteredToolName(name: string): name is RegisteredToolName {
  return name in TOOL_SCHEMAS;
}

export function resolveToolDefinitions(names: string[]): ToolDefinition[] {
  return names.filter(isRegisteredToolName).map((name) => TOOL_SCHEMAS[name]);
}

export async function executeRegisteredTool(
  name: string,
  input: Record<string, unknown>,
  session: CreateDraftToolSession,
  contextMode: ContextStorageMode,
): Promise<ToolExecutionOutcome> {
  if (!isRegisteredToolName(name)) {
    return {
      result: { error: `未知の tool: ${name}` },
      display: { summary: "error", display: `✗ ${name}` },
    };
  }

  switch (name) {
    case "search_company_context":
      return executeSearchCompanyContext(
        input as SearchCompanyContextInput,
        session,
        contextMode,
      );
    case "select_company_context":
      return executeSelectCompanyContext(input as SelectCompanyContextInput, session);
    default:
      return {
        result: { error: `未知の tool: ${name}` },
        display: { summary: "error", display: `✗ ${name}` },
      };
  }
}
