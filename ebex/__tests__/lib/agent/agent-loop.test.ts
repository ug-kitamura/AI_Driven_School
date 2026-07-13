import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractToolErrorMessage,
  isBrokenToolUse,
  runAgentLoop,
} from "@/lib/agent/agent-loop";
import {
  AGENT_BROKEN_TOOL_USE_ERROR,
  AGENT_MISSING_PATH_ERROR,
  AGENT_MISSING_SCRIPT_INPUT_ERROR,
  AGENT_REPEATED_TOOL_ERROR,
} from "@/lib/agent/llm/types";
import type { ProviderTurnResult, StreamEvent } from "@/lib/agent/llm/types";

vi.mock("@/lib/api-keys", () => ({
  resolveAiApiKey: () => "test-key",
}));

vi.mock("@/lib/agent/llm/resolve-provider", () => ({
  resolveLlmProvider: vi.fn(),
}));

vi.mock("@/lib/agent/tools/registry", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/agent/tools/registry")
  >("@/lib/agent/tools/registry");
  return {
    ...actual,
    executeRegisteredTool: vi.fn(),
  };
});

vi.mock("@/lib/agent/project-folder-guard", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/agent/project-folder-guard")>();
  return {
    ...actual,
    checkProjectFolderExists: vi.fn(() => null),
  };
});

import { resolveLlmProvider } from "@/lib/agent/llm/resolve-provider";
import { executeRegisteredTool } from "@/lib/agent/tools/registry";
import {
  checkProjectFolderExists,
  AGENT_PROJECT_FOLDER_MISSING_ERROR,
} from "@/lib/agent/project-folder-guard";

function mockProvider(turns: ProviderTurnResult[]) {
  let index = 0;
  return {
    async *streamTurn(): AsyncGenerator<StreamEvent> {
      const result = turns[index] ?? {
        text: "",
        toolCalls: [],
        stopReason: "end_turn" as const,
      };
      index += 1;
      yield { type: "turn_complete", result };
    },
    async runTurn() {
      return turns[0]!;
    },
  };
}

describe("isBrokenToolUse", () => {
  it("detects inputParseError", () => {
    expect(
      isBrokenToolUse({
        id: "1",
        name: "write_file",
        input: {},
        inputParseError: true,
      }),
    ).toBe(AGENT_BROKEN_TOOL_USE_ERROR);
  });

  it("detects missing path on path-required tools", () => {
    expect(isBrokenToolUse({ id: "1", name: "write_file", input: {} })).toBe(
      AGENT_MISSING_PATH_ERROR,
    );
    expect(
      isBrokenToolUse({ id: "1", name: "read_file", input: { path: "  " } }),
    ).toBe(AGENT_MISSING_PATH_ERROR);
    expect(
      isBrokenToolUse({ id: "1", name: "list_files", input: {} }),
    ).toBeNull();
  });

  it("detects missing code / script_path on script tools", () => {
    expect(
      isBrokenToolUse({ id: "1", name: "run_script", input: { writes: [] } }),
    ).toBe(AGENT_MISSING_SCRIPT_INPUT_ERROR);
    expect(
      isBrokenToolUse({ id: "1", name: "run_skill_script", input: {} }),
    ).toBe(AGENT_MISSING_SCRIPT_INPUT_ERROR);
    expect(
      isBrokenToolUse({
        id: "1",
        name: "run_script",
        input: { code: 'const fs = require("fs");', writes: [] },
      }),
    ).toBeNull();
    expect(
      isBrokenToolUse({
        id: "1",
        name: "run_skill_script",
        input: { script_path: "scripts/build.cjs" },
      }),
    ).toBeNull();
  });
});

describe("extractToolErrorMessage", () => {
  it("reads error string from tool result", () => {
    expect(extractToolErrorMessage({ error: "path が空です" })).toBe(
      "path が空です",
    );
    expect(extractToolErrorMessage({ path: "ok" })).toBeNull();
  });
});

describe("runAgentLoop safety valves", () => {
  beforeEach(() => {
    vi.mocked(resolveLlmProvider).mockReset();
    vi.mocked(executeRegisteredTool).mockReset();
    vi.mocked(checkProjectFolderExists).mockReset();
    vi.mocked(checkProjectFolderExists).mockReturnValue(null);
  });

  it("returns broken tool_use as recoverable tool_result and continues", async () => {
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-4-6",
      provider: mockProvider([
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [
            {
              id: "tu1",
              name: "write_file",
              input: {},
              inputParseError: true,
            },
          ],
        },
        {
          text: "switched approach",
          stopReason: "end_turn",
          toolCalls: [],
        },
      ]),
    });

    const emit = vi.fn();
    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit,
      projectFolderId: "demo",
    });

    expect(result.ok).toBe(true);
    expect(executeRegisteredTool).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      "tool_end",
      expect.objectContaining({
        toolUseId: "tu1",
        result: expect.stringContaining("recoverable"),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "tool_end",
      expect.objectContaining({
        result: expect.stringContaining("copy_file"),
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      "tool_end",
      expect.objectContaining({
        result: expect.stringContaining("replace_between"),
      }),
    );
  });

  it("returns missing path as recoverable tool_result without executing", async () => {
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-4-6",
      provider: mockProvider([
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [
            { id: "tu1", name: "write_file", input: { content: "x" } },
          ],
        },
        {
          text: "ok",
          stopReason: "end_turn",
          toolCalls: [],
        },
      ]),
    });

    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit: vi.fn(),
      projectFolderId: "demo",
    });

    expect(result.ok).toBe(true);
    expect(executeRegisteredTool).not.toHaveBeenCalled();
  });

  it("continues after 2 identical tool errors then stops on the 3rd", async () => {
    const errorResult = {
      error: "ファイルが見つかりません: workspace/demo/x.md",
    };
    vi.mocked(executeRegisteredTool).mockResolvedValue({
      result: errorResult,
      display: { summary: "error", display: "✗ err" },
    });

    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-4-6",
      provider: mockProvider([
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [{ id: "1", name: "read_file", input: { path: "x.md" } }],
        },
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [{ id: "2", name: "read_file", input: { path: "x.md" } }],
        },
        {
          text: "",
          stopReason: "tool_use",
          toolCalls: [{ id: "3", name: "read_file", input: { path: "x.md" } }],
        },
      ]),
    });

    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit: vi.fn(),
      projectFolderId: "demo",
    });

    expect(executeRegisteredTool).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(AGENT_REPEATED_TOOL_ERROR);
    expect(result.error).toContain("ファイルが見つかりません");
  });

  it("aborts immediately when project folder is missing", async () => {
    vi.mocked(checkProjectFolderExists).mockReturnValue(
      `${AGENT_PROJECT_FOLDER_MISSING_ERROR} (workspace/demo)`,
    );
    vi.mocked(resolveLlmProvider).mockReturnValue({
      ok: true,
      model: "claude-sonnet-4-6",
      provider: mockProvider([
        {
          text: "hi",
          stopReason: "end_turn",
          toolCalls: [],
        },
      ]),
    });

    const result = await runAgentLoop({
      req: new Request("http://localhost/api/agent/invoke"),
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      toolNames: [],
      emit: vi.fn(),
      projectFolderId: "demo",
    });

    expect(result).toEqual({
      ok: false,
      error: `${AGENT_PROJECT_FOLDER_MISSING_ERROR} (workspace/demo)`,
      status: 409,
    });
    expect(executeRegisteredTool).not.toHaveBeenCalled();
  });
});
