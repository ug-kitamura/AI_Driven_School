import { describe, expect, it } from "vitest";
import { parseAnthropicStream } from "@/lib/agent/llm/anthropic";

function sseBody(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const text = events
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe("parseAnthropicStream", () => {
  it("marks tool_use with invalid JSON as inputParseError", async () => {
    const body = sseBody([
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "tu1", name: "write_file" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: "{not-json" },
      },
      { type: "content_block_stop", index: 0 },
      {
        type: "message_delta",
        delta: { stop_reason: "tool_use" },
      },
    ]);

    let turn = null;
    for await (const event of parseAnthropicStream(body)) {
      if (event.type === "turn_complete") turn = event.result;
    }

    expect(turn?.toolCalls).toHaveLength(1);
    expect(turn?.toolCalls[0]).toMatchObject({
      id: "tu1",
      name: "write_file",
      input: {},
      inputParseError: true,
    });
  });

  it("parses valid tool_use JSON without inputParseError", async () => {
    const body = sseBody([
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "tu2", name: "read_file" },
      },
      {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "input_json_delta",
          partial_json: '{"path":"notes.md"}',
        },
      },
      { type: "content_block_stop", index: 0 },
      {
        type: "message_delta",
        delta: { stop_reason: "tool_use" },
      },
    ]);

    let turn = null;
    for await (const event of parseAnthropicStream(body)) {
      if (event.type === "turn_complete") turn = event.result;
    }

    expect(turn?.toolCalls[0]).toEqual({
      id: "tu2",
      name: "read_file",
      input: { path: "notes.md" },
    });
  });
});
