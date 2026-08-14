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
