"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  buildView,
  collapseSeries,
  dimmedEdgeIds,
  dimmedNodeIds,
  type MandalaScope,
} from "@/lib/mandala/graph";
import { layoutTopDown } from "@/lib/mandala/layout";
import { mandalaNodeTypes, type MandalaNodeData } from "./nodes";
import { data as siteData } from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";

const SIZES = {
  compact: { width: 190, height: 44 },
  card: { width: 230, height: 116 },
  collapsedSeries: { width: 210, height: 72 },
} as const;

export type MandalaProps = {
  scope: MandalaScope;
  locale?: Locale;
  /** グローバル曼陀羅ではミニマップとシリーズ折りたたみを出す */
  height?: number;
};

export function Mandala({ scope, locale = "ja", height = 460 }: MandalaProps) {
  const router = useRouter();
  const [collapsedSlugs, setCollapsedSlugs] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [interactive, setInteractive] = useState(false);

  const isGlobal = scope.kind === "global";
  const variant = isGlobal ? "compact" : "card";

  const view = useMemo(() => buildView(siteData.mandala, scope), [scope]);
  const collapsible = useMemo(
    () =>
      isGlobal
        ? collapseSeries(view, collapsedSlugs)
        : { ...view, collapsed: [] },
    [view, collapsedSlugs, isGlobal],
  );

  const allNodeIds = useMemo(
    () => [
      ...collapsible.nodes.map((n) => n.id),
      ...collapsible.collapsed.map((s) => s.id),
    ],
    [collapsible],
  );
  const dimmedNodes = useMemo(
    () => dimmedNodeIds(collapsible.edges, allNodeIds, hoveredId),
    [collapsible.edges, allNodeIds, hoveredId],
  );
  const dimmedEdges = useMemo(
    () => dimmedEdgeIds(collapsible.edges, hoveredId),
    [collapsible.edges, hoveredId],
  );

  const { nodes, edges } = useMemo(() => {
    const entries: Array<{
      id: string;
      type: keyof typeof SIZES;
      data: MandalaNodeData;
      href: string;
    }> = [
      ...collapsible.nodes.map((node) => ({
        id: node.id,
        type: variant as keyof typeof SIZES,
        href: node.href,
        data: {
          label: node.label,
          href: node.href,
          seriesName: node.seriesName,
          catch: node.catch,
          lessonCount: node.lessonCount,
          totalMinutes: node.totalMinutes,
          status: node.status,
          ghost: node.ghost,
          current: node.current,
          dimmed: dimmedNodes.has(node.id),
        } satisfies MandalaNodeData,
      })),
      ...collapsible.collapsed.map((series) => ({
        id: series.id,
        type: "collapsedSeries" as const,
        href: series.href,
        data: {
          label: series.seriesName,
          href: series.href,
          seriesName: series.seriesName,
          lessonCount: series.lessonCount,
          totalMinutes: series.totalMinutes,
          status: "in_progress" as const,
          ghost: false,
          current: false,
          dimmed: dimmedNodes.has(series.id),
          collapsed: { courseCount: series.courseCount },
        } satisfies MandalaNodeData,
      })),
    ];

    const positions = layoutTopDown(
      entries.map((e) => e.id),
      collapsible.edges,
      {
        size: SIZES[variant],
        sizeOf: (id) =>
          SIZES[entries.find((e) => e.id === id)?.type ?? variant],
      },
    );
    const positionById = new Map(positions.map((p) => [p.id, p]));

    const flowNodes: Node[] = entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      position: positionById.get(entry.id) ?? { x: 0, y: 0 },
      data: entry.data as unknown as Record<string, unknown>,
      draggable: false,
      connectable: false,
    }));

    const flowEdges: Edge[] = collapsible.edges.map((edge) => {
      const dimmed = dimmedEdges.has(edge.id);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        // 同一シリーズ内の「次に進む」辺だけ流れを見せる
        animated: edge.kind === "order",
        className: [
          "dxm-edge",
          edge.kind === "cross" ? "dxm-edge-cross" : "dxm-edge-order",
          dimmed && "dxm-edge-dimmed",
        ]
          .filter(Boolean)
          .join(" "),
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [collapsible, dimmedNodes, dimmedEdges, variant]);

  const hrefById = useMemo(
    () =>
      new Map<string, string>([
        ...collapsible.nodes.map((n) => [n.id, n.href] as const),
        ...collapsible.collapsed.map((s) => [s.id, s.href] as const),
      ]),
    [collapsible],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const href = hrefById.get(node.id);
      if (href) router.push(localizedHref(href, locale));
    },
    [hrefById, router, locale],
  );

  const seriesSlugs = useMemo(
    () => [...new Set(siteData.mandala.nodes.map((n) => n.seriesSlug))],
    [],
  );

  const toggleSeries = (slug: string) => {
    setCollapsedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  if (nodes.length === 0) return null;

  return (
    <div className="dxm-mandala">
      {isGlobal && (
        <div className="dxm-mandala-toolbar">
          {seriesSlugs.map((slug) => {
            const collapsed = collapsedSlugs.has(slug);
            const name =
              siteData.mandala.nodes.find((n) => n.seriesSlug === slug)
                ?.seriesName ?? slug;
            return (
              <button
                key={slug}
                type="button"
                className="dxm-mandala-toggle"
                aria-pressed={collapsed}
                onClick={() => toggleSeries(slug)}
              >
                {collapsed ? "▸" : "▾"} {name}
              </button>
            );
          })}
        </div>
      )}
      <div
        className="dxm-mandala-canvas"
        style={{ height }}
        // クリックするまではページスクロールを優先する
        onClick={() => setInteractive(true)}
        onMouseLeave={() => setHoveredId(null)}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={mandalaNodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          zoomOnScroll={interactive}
          preventScrolling={interactive}
          panOnDrag={interactive}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={(_e, node) => setHoveredId(node.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
        >
          <Background gap={20} />
          {isGlobal && <MiniMap pannable zoomable />}
          {interactive && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
    </div>
  );
}
