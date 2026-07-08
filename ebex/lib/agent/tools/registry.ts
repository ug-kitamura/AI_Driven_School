import type { ToolDefinition } from "@/lib/agent/llm/types";

export type ToolExecutionDisplay = {
  summary: string;
  display: string;
  tags?: string[];
};

export type ToolExecutionOutcome = {
  result: unknown;
  display: ToolExecutionDisplay;
};

const TOOL_SCHEMAS = {} as const;

export type RegisteredToolName = keyof typeof TOOL_SCHEMAS;

export function isRegisteredToolName(name: string): name is RegisteredToolName {
  return name in TOOL_SCHEMAS;
}

export function resolveToolDefinitions(_names: string[]): ToolDefinition[] {
  return [];
}

export async function executeRegisteredTool(
  name: string,
): Promise<ToolExecutionOutcome> {
  return {
    result: { error: `未知の tool: ${name}` },
    display: { summary: "error", display: `✗ ${name}` },
  };
}
