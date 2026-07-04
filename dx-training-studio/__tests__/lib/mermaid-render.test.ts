import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMermaidRenderQueueForTests } from "@/lib/mermaid-render";

const initialize = vi.fn();
const render = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize,
    render,
  },
}));

describe("renderMermaidDiagram", () => {
  beforeEach(() => {
    resetMermaidRenderQueueForTests();
    initialize.mockReset();
    render.mockReset();
  });

  afterEach(() => {
    resetMermaidRenderQueueForTests();
  });

  it("serializes initialize+render so later config cannot race earlier layout", async () => {
    const { renderMermaidDiagram } = await import("@/lib/mermaid-render");

    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    render.mockImplementationOnce(async () => {
      order.push("render-start:first");
      await firstGate;
      order.push("render-end:first");
      return { svg: "<svg>a</svg>", bindFunctions: undefined };
    });
    render.mockImplementationOnce(async () => {
      order.push("render-start:second");
      order.push("render-end:second");
      return { svg: "<svg>b</svg>", bindFunctions: undefined };
    });

    initialize.mockImplementation((config: { flowchart?: { padding?: number } }) => {
      order.push(`init:${config.flowchart?.padding ?? "?"}`);
    });

    const first = renderMermaidDiagram(
      "flowchart TD\n  A",
      { flowchart: { padding: 1 } } as never,
      "first",
    );
    const second = renderMermaidDiagram(
      "flowchart TD\n  B",
      { flowchart: { padding: 2 } } as never,
      "second",
    );

    await vi.waitFor(() => {
      expect(order).toEqual(["init:1", "render-start:first"]);
    });
    expect(render.mock.calls[0]?.[0]).toMatch(/^first-/);

    releaseFirst();
    const [a, b] = await Promise.all([first, second]);

    expect(a.svg).toBe("<svg>a</svg>");
    expect(b.svg).toBe("<svg>b</svg>");
    expect(render.mock.calls[1]?.[0]).toMatch(/^second-/);
    expect(order).toEqual([
      "init:1",
      "render-start:first",
      "render-end:first",
      "init:2",
      "render-start:second",
      "render-end:second",
    ]);
  });
});
