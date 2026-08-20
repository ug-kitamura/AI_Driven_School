/**
 * dagre による自動レイアウト。React Flow に渡す座標を計算する。上から下（TB）。
 * 公開サイト `mandala/lib/mandala/layout.ts` の移植。
 */
import dagre from "@dagrejs/dagre";
import type { MandalaEdge } from "@/lib/mandala/graph";

export type LayoutSize = { width: number; height: number };

export type PositionedNode = {
  id: string;
  x: number;
  y: number;
};

export type LayoutOptions = {
  /** ノードの既定サイズ。密度（compact / card）で変える */
  size: LayoutSize;
  /** 同じ段の間隔 */
  nodeSep?: number;
  /** 段と段の間隔 */
  rankSep?: number;
  sizeOf?: (id: string) => LayoutSize | undefined;
};

export function layoutFlow(
  nodeIds: readonly string[],
  edges: readonly MandalaEdge[],
  options: LayoutOptions,
): PositionedNode[] {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: "TB",
    nodesep: options.nodeSep ?? 48,
    ranksep: options.rankSep ?? 72,
    marginx: 24,
    marginy: 24,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const known = new Set(nodeIds);
  for (const id of nodeIds) {
    const size = options.sizeOf?.(id) ?? options.size;
    graph.setNode(id, { width: size.width, height: size.height });
  }
  for (const edge of edges) {
    if (known.has(edge.source) && known.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(graph);

  return nodeIds.map((id) => {
    const node = graph.node(id) as
      | { x: number; y: number; width: number; height: number }
      | undefined;
    const size = options.sizeOf?.(id) ?? options.size;
    // dagre は中心座標を返す。React Flow は左上基準なので変換する
    return {
      id,
      x: (node?.x ?? 0) - (node?.width ?? size.width) / 2,
      y: (node?.y ?? 0) - (node?.height ?? size.height) / 2,
    };
  });
}
