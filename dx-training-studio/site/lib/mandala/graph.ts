/**
 * 曼陀羅グラフの操作（純関数）。React Flow に依存しない——描画から切り離してテストできるようにする。
 */
import type { MandalaEdge, MandalaGraph, MandalaNode } from "@/lib/site-data";

export type MandalaScope =
  | { kind: "global" }
  | { kind: "series"; seriesSlug: string }
  | { kind: "course"; courseId: string };

export type ViewNode = MandalaNode & {
  /** 表示中のシリーズ / コース外のノード（半透明で描く） */
  ghost: boolean;
  /** 現在地（シリーズ曼陀羅ではシリーズ内、ミニ曼陀羅では当該コース） */
  current: boolean;
};

export type MandalaView = {
  nodes: ViewNode[];
  edges: MandalaEdge[];
};

function nodeMap(graph: MandalaGraph): Map<string, MandalaNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

/** グローバル曼陀羅: 全ノード・全辺。ゴーストなし */
export function globalView(graph: MandalaGraph): MandalaView {
  return {
    nodes: graph.nodes.map((n) => ({ ...n, ghost: false, current: false })),
    edges: graph.edges,
  };
}

/**
 * シリーズ曼陀羅: そのシリーズのコース＋跨ぎで繋がる相手コース（ゴースト）。
 * ゴースト同士だけを結ぶ辺は含めない——当該シリーズと関係のない線を描かない。
 */
export function seriesView(
  graph: MandalaGraph,
  seriesSlug: string,
): MandalaView {
  const byId = nodeMap(graph);
  const inSeries = new Set(
    graph.nodes.filter((n) => n.seriesSlug === seriesSlug).map((n) => n.id),
  );

  const edges = graph.edges.filter(
    (e) => inSeries.has(e.source) || inSeries.has(e.target),
  );

  const ghostIds = new Set<string>();
  for (const edge of edges) {
    if (!inSeries.has(edge.source)) ghostIds.add(edge.source);
    if (!inSeries.has(edge.target)) ghostIds.add(edge.target);
  }

  const nodes: ViewNode[] = [
    ...graph.nodes
      .filter((n) => inSeries.has(n.id))
      .map((n) => ({ ...n, ghost: false, current: true })),
    ...[...ghostIds]
      .map((id) => byId.get(id))
      .filter((n): n is MandalaNode => Boolean(n))
      .map((n) => ({ ...n, ghost: true, current: false })),
  ];

  return { nodes, edges };
}

/** ミニ曼陀羅: 中央のコースと、その直前・直後だけ（跨ぎを含む） */
export function courseView(graph: MandalaGraph, courseId: string): MandalaView {
  const byId = nodeMap(graph);
  const center = byId.get(courseId);
  if (!center) return { nodes: [], edges: [] };

  const edges = graph.edges.filter(
    (e) => e.source === courseId || e.target === courseId,
  );
  const neighborIds = new Set<string>();
  for (const edge of edges) {
    neighborIds.add(edge.source === courseId ? edge.target : edge.source);
  }

  const nodes: ViewNode[] = [
    { ...center, ghost: false, current: true },
    ...[...neighborIds]
      .map((id) => byId.get(id))
      .filter((n): n is MandalaNode => Boolean(n))
      .map((n) => ({
        ...n,
        ghost: n.seriesSlug !== center.seriesSlug,
        current: false,
      })),
  ];

  return { nodes, edges };
}

export function buildView(
  graph: MandalaGraph,
  scope: MandalaScope,
): MandalaView {
  switch (scope.kind) {
    case "global":
      return globalView(graph);
    case "series":
      return seriesView(graph, scope.seriesSlug);
    case "course":
      return courseView(graph, scope.courseId);
  }
}

/** ノードから遡れる上流すべて（自身を含む） */
export function ancestorsOf(
  edges: readonly MandalaEdge[],
  nodeId: string,
): Set<string> {
  const result = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.target === current && !result.has(edge.source)) {
        result.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return result;
}

/** ノードから辿れる下流すべて（自身を含む） */
export function descendantsOf(
  edges: readonly MandalaEdge[],
  nodeId: string,
): Set<string> {
  const result = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === current && !result.has(edge.target)) {
        result.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return result;
}

/** ホバー時に強調するノード集合（上流 ∪ 下流） */
export function traceFrom(
  edges: readonly MandalaEdge[],
  nodeId: string,
): Set<string> {
  const trace = ancestorsOf(edges, nodeId);
  for (const id of descendantsOf(edges, nodeId)) trace.add(id);
  return trace;
}

/**
 * ホバー時に減光するノード ID（経路に含まれないもの）。
 * 全ノードが1本に繋がるコンテンツでは空集合になる——それが正しい挙動。
 */
export function dimmedNodeIds(
  edges: readonly MandalaEdge[],
  nodeIds: readonly string[],
  hoveredId: string | null,
): Set<string> {
  if (!hoveredId) return new Set();
  const trace = traceFrom(edges, hoveredId);
  return new Set(nodeIds.filter((id) => !trace.has(id)));
}

/** ホバー時に減光する辺（両端が経路に含まれないもの） */
export function dimmedEdgeIds(
  edges: readonly MandalaEdge[],
  hoveredId: string | null,
): Set<string> {
  if (!hoveredId) return new Set();
  const trace = traceFrom(edges, hoveredId);
  return new Set(
    edges
      .filter((e) => !(trace.has(e.source) && trace.has(e.target)))
      .map((e) => e.id),
  );
}

export type CollapsedSeries = {
  /** 集約ノードの ID（`series:<slug>`） */
  id: string;
  seriesSlug: string;
  seriesName: string;
  href: string;
  courseCount: number;
  lessonCount: number;
  totalMinutes: number;
};

export type CollapsibleView = {
  nodes: ViewNode[];
  collapsed: CollapsedSeries[];
  edges: MandalaEdge[];
};

/**
 * 指定シリーズを1ノードへ畳む。
 * 畳んだシリーズに繋がる辺は集約ノードへ張り替え、内部の辺は落とす。
 */
export function collapseSeries(
  view: MandalaView,
  collapsedSlugs: ReadonlySet<string>,
): CollapsibleView {
  if (collapsedSlugs.size === 0) {
    return { nodes: view.nodes, collapsed: [], edges: view.edges };
  }

  const collapsedIdOf = (slug: string) => `series:${slug}`;
  const nodeSeries = new Map(view.nodes.map((n) => [n.id, n.seriesSlug]));

  const collapsed: CollapsedSeries[] = [];
  for (const slug of collapsedSlugs) {
    const members = view.nodes.filter((n) => n.seriesSlug === slug);
    if (members.length === 0) continue;
    collapsed.push({
      id: collapsedIdOf(slug),
      seriesSlug: slug,
      seriesName: members[0]!.seriesName,
      href: `/${slug}`,
      courseCount: members.length,
      lessonCount: members.reduce((sum, n) => sum + n.lessonCount, 0),
      totalMinutes: members.reduce((sum, n) => sum + n.totalMinutes, 0),
    });
  }

  const nodes = view.nodes.filter((n) => !collapsedSlugs.has(n.seriesSlug));

  const resolve = (id: string) => {
    const slug = nodeSeries.get(id);
    return slug && collapsedSlugs.has(slug) ? collapsedIdOf(slug) : id;
  };

  const edges: MandalaEdge[] = [];
  const seen = new Set<string>();
  for (const edge of view.edges) {
    const source = resolve(edge.source);
    const target = resolve(edge.target);
    if (source === target) continue; // シリーズ内部の辺は集約で消える
    const id = `${source}__${target}`;
    if (seen.has(id)) continue;
    seen.add(id);
    edges.push({ id, source, target, kind: edge.kind });
  }

  return { nodes, collapsed, edges };
}
