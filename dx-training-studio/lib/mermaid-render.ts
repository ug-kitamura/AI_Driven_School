import type { MermaidConfig } from "mermaid";

export type MermaidRenderResult = {
  svg: string;
  bindFunctions?: (element: Element) => void;
};

/**
 * Mermaid の initialize / render はプロセス全体で共有状態を使う。
 * 並列に呼ぶと後勝ちの config（subGraphTitleMargin など）が他方のレイアウトに混入し、
 * subgraph 余白が間欠的に潰れる。initialize→render を直列化する。
 */
let renderChain: Promise<void> = Promise.resolve();

/** @internal vitest 用。本番コードから呼ばないこと。 */
export function resetMermaidRenderQueueForTests(): void {
  renderChain = Promise.resolve();
}

function nextRenderId(idPrefix: string): string {
  const safe = idPrefix.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function renderMermaidDiagram(
  definition: string,
  config: MermaidConfig,
  idPrefix: string,
): Promise<MermaidRenderResult> {
  const run = async (): Promise<MermaidRenderResult> => {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize(config);
    const { svg, bindFunctions } = await mermaid.render(
      nextRenderId(idPrefix),
      definition,
    );
    return { svg, bindFunctions: bindFunctions ?? undefined };
  };

  const result = renderChain.then(run, run);
  renderChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
