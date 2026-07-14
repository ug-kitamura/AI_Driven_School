import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractToolErrorMessage,
  isBrokenToolUse,
  runAgentLoop,
  runTurnWithMaxTokensContinuation,
} from "@/lib/agent/agent-loop";
import {
  AGENT_BROKEN_TOOL_USE_ERROR,
  AGENT_MISSING_GENERATE_INPUT_ERROR,
  AGENT_MISSING_PATH_ERROR,
  AGENT_MISSING_SCRIPT_INPUT_ERROR,
  AGENT_REPEATED_TOOL_ERROR,
  AGENT_TEXT_CONTINUATION_LIMIT_NOTICE,
  MAX_TEXT_CONTINUATIONS_PER_TURN,
} from "@/lib/agent/llm/types";
import type { ProviderTurnResult, StreamEvent } from "@/lib/agent/llm/types";
import type { LlmProvider } from "@/lib/agent/llm/provider";

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

  it("detects missing path / instruction on generate_and_write", () => {
    expect(
      isBrokenToolUse({
        id: "1",
        name: "generate_and_write",
        input: { path: "out.html" },
      }),
    ).toBe(AGENT_MISSING_GENERATE_INPUT_ERROR);
    expect(
      isBrokenToolUse({
        id: "1",
        name: "generate_and_write",
        input: { instruction: "書く" },
      }),
    ).toBe(AGENT_MISSING_GENERATE_INPUT_ERROR);
    expect(
      isBrokenToolUse({
        id: "1",
        name: "generate_and_write",
        input: { path: "out.html", instruction: "書く" },
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

type Step = {
  text: string;
  stopReason: ProviderTurnResult["stopReason"];
  toolCalls?: ProviderTurnResult["toolCalls"];
};

/** streamTurn が text_delta → turn_complete を順に返す最小のプロバイダスタブ */
function streamingProvider(steps: Step[]): {
  provider: LlmProvider;
  callCount: () => number;
} {
  let index = 0;
  const provider: LlmProvider = {
    async runTurn() {
      throw new Error("not used");
    },
    async *streamTurn(): AsyncGenerator<StreamEvent> {
      const step = steps[Math.min(index, steps.length - 1)];
      index += 1;
      if (step.text) {
        yield { type: "text_delta", text: step.text };
      }
      yield {
        type: "turn_complete",
        result: {
          text: step.text,
          toolCalls: step.toolCalls ?? [],
          stopReason: step.stopReason,
        },
      };
    },
  };
  return { provider, callCount: () => index };
}

describe("runTurnWithMaxTokensContinuation", () => {
  it("continues automatically after a max_tokens turn and stitches the text", async () => {
    const { provider, callCount } = streamingProvider([
      { text: "first-half", stopReason: "max_tokens" },
      { text: "-second-half", stopReason: "end_turn" },
    ]);
    const emit = vi.fn();

    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toBe("first-half-second-half");
    expect(outcome.result.stopReason).toBe("end_turn");
    expect(callCount()).toBe(2);
    expect(emit).toHaveBeenCalledWith("text_delta", { text: "first-half" });
    expect(emit).toHaveBeenCalledWith("text_delta", { text: "-second-half" });
    expect(outcome.text).not.toContain(AGENT_TEXT_CONTINUATION_LIMIT_NOTICE);
  });

  it("stops after the continuation limit and appends a truncation notice", async () => {
    const steps: Step[] = Array.from(
      { length: MAX_TEXT_CONTINUATIONS_PER_TURN + 1 },
      (_, i) => ({ text: `chunk${i}`, stopReason: "max_tokens" as const }),
    );
    const { provider, callCount } = streamingProvider(steps);
    const emit = vi.fn();

    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // 初回 + 継続 4 回 = 5 回で打ち切り、6 回目は呼ばれない
    expect(callCount()).toBe(MAX_TEXT_CONTINUATIONS_PER_TURN + 1);
    expect(outcome.text).toContain("chunk0");
    expect(outcome.text).toContain(`chunk${MAX_TEXT_CONTINUATIONS_PER_TURN}`);
    expect(outcome.text).toContain(AGENT_TEXT_CONTINUATION_LIMIT_NOTICE);
    expect(emit).toHaveBeenCalledWith("text_delta", {
      text: AGENT_TEXT_CONTINUATION_LIMIT_NOTICE,
    });
  });

  it("does not continue when the turn completes normally without tool calls", async () => {
    const { provider, callCount } = streamingProvider([
      { text: "done", stopReason: "end_turn" },
    ]);
    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit: vi.fn(),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.text).toBe("done");
    expect(callCount()).toBe(1);
  });

  it("does not continue when a max_tokens turn already carries tool calls", async () => {
    const toolCalls: ProviderTurnResult["toolCalls"] = [
      { id: "t1", name: "read_file", input: { path: "a.md" } },
    ];
    const { provider, callCount } = streamingProvider([
      { text: "planning", stopReason: "max_tokens", toolCalls },
    ]);
    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit: vi.fn(),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(callCount()).toBe(1);
    expect(outcome.result.toolCalls).toEqual(toolCalls);
  });

  it("stops continuing once a later continuation turn returns tool calls", async () => {
    const toolCalls: ProviderTurnResult["toolCalls"] = [
      { id: "t1", name: "write_file", input: { path: "out.md", content: "x" } },
    ];
    const { provider, callCount } = streamingProvider([
      { text: "first-half", stopReason: "max_tokens" },
      { text: "", stopReason: "tool_use", toolCalls },
    ]);
    const outcome = await runTurnWithMaxTokensContinuation({
      provider,
      apiKey: "key",
      model: "claude-test",
      system: "sys",
      baseMessages: [{ role: "user", content: "hi" }],
      tools: [],
      emit: vi.fn(),
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(callCount()).toBe(2);
    expect(outcome.text).toBe("first-half");
    expect(outcome.result.toolCalls).toEqual(toolCalls);
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

  it("returns generate_and_write schema guidance for missing instruction", async () => {
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
              name: "generate_and_write",
              input: { path: "out.html" },
            },
          ],
        },
        {
          text: "ok",
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
        result: expect.stringContaining("generate_and_write の入力は"),
      }),
    );
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
