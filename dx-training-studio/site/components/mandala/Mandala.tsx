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
import { buildView, collapseSeries, type MandalaScope } from "@/lib/mandala/graph";
import {
  layoutFlow,
  type LayoutDirection,
  type LayoutSize,
} from "@/lib/mandala/layout";
import {
  mandalaNodeTypes,
  type MandalaNodeData,
  type SeriesFrameData,
} from "./nodes";
import { data as siteData } from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";

const SIZES = {
  compact: { width: 200, height: 52 },
  card: { width: 280, height: 140 },
  collapsedSeries: { width: 210, height: 72 },
} as const;

/** シリーズ枠がコース群の外へどれだけはみ出すか */
const FRAME_PADDING = { x: 22, top: 30, bottom: 18 };

type ScopeStyle = {
  variant: "compact" | "card";
  direction: LayoutDirection;
  height: number;
};

/** 見た目は scope で決まる。全体・シリーズは一覧性、コースは読み物としての大きさ */
function styleOf(scope: MandalaScope): ScopeStyle {
  switch (scope.kind) {
    case "global":
      return { variant: "compact", direction: "TB", height: 640 };
    case "series":
      return { variant: "compact", direction: "TB", height: 560 };
    case "course":
      return { variant: "card", direction: "LR", height: 440 };
  }
}

export type MandalaProps = {
  scope: MandalaScope;
  locale?: Locale;
  /** 既定の高さを上書きする（scope ごとの既定は styleOf） */
  height?: number;
};

export function Mandala({ scope, locale = "ja", height }: MandalaProps) {
  const router = useRouter();
  const [collapsedSlugs, setCollapsedSlugs] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [interactive, setInteractive] = useState(false);

  const isGlobal = scope.kind === "global";
  const { variant, direction, height: defaultHeight } = styleOf(scope);
  const canvasHeight = height ?? defaultHeight;

  const view = useMemo(() => buildView(siteData.mandala, scope), [scope]);
  const collapsible = useMemo(
    () =>
      isGlobal
        ? collapseSeries(view, collapsedSlugs)
        : { ...view, collapsed: [] },
    [view, collapsedSlugs, isGlobal],
  );

  const { nodes, edges } = useMemo(() => {
    const entries: Array<{
      id: string;
      type: keyof typeof SIZES;
      data: MandalaNodeData;
      seriesSlug: string;
    }> = [
      ...collapsible.nodes.map((node) => ({
        id: node.id,
        type: variant as keyof typeof SIZES,
        seriesSlug: node.seriesSlug,
        data: {
          label: node.label,
          href: node.href,
          seriesName: node.seriesName,
          catch: node.catch,
          lessonCount: node.lessonCount,
          totalMinutes: node.totalMinutes,
          style: node.style,
          locale,
          ghost: node.ghost,
          current: node.current,
        } satisfies MandalaNodeData,
      })),
      ...collapsible.collapsed.map((series) => ({
        id: series.id,
        type: "collapsedSeries" as const,
        seriesSlug: series.seriesSlug,
        data: {
          label: series.seriesName,
          href: series.href,
          seriesName: series.seriesName,
          lessonCount: series.lessonCount,
          totalMinutes: series.totalMinutes,
          locale,
          ghost: false,
          current: false,
          collapsed: { courseCount: series.courseCount },
        } satisfies MandalaNodeData,
      })),
    ];

    const sizeOf = (id: string): LayoutSize =>
      SIZES[entries.find((e) => e.id === id)?.type ?? variant];

    const positions = layoutFlow(
      entries.map((e) => e.id),
      collapsible.edges,
      { size: SIZES[variant], direction, sizeOf },
    );
    const positionById = new Map(positions.map((p) => [p.id, p]));

    const courseNodes: Node[] = entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      position: positionById.get(entry.id) ?? { x: 0, y: 0 },
      data: entry.data as unknown as Record<string, unknown>,
      draggable: false,
      connectable: false,
    }));

    // 全体曼陀羅だけ、シリーズごとのコース群を背景の枠で囲う。
    // React Flow の親子関係は使わない——dagre の絶対座標と二重管理になるため、
    // レイアウト結果から矩形を求めて背後に敷くだけにする。
    const frameNodes: Node[] = isGlobal
      ? [...new Set(entries.map((e) => e.seriesSlug))].flatMap((slug) => {
          // 折りたたみ中のシリーズは集約ノード1つなので枠を描かない
          if (collapsedSlugs.has(slug)) return [];
          const members = entries.filter((e) => e.seriesSlug === slug);
          if (members.length === 0) return [];

          const boxes = members.map((m) => {
            const p = positionById.get(m.id) ?? { x: 0, y: 0 };
            const size = sizeOf(m.id);
            return { x: p.x, y: p.y, w: size.width, h: size.height };
          });
          const minX = Math.min(...boxes.map((b) => b.x));
          const minY = Math.min(...boxes.map((b) => b.y));
          const maxX = Math.max(...boxes.map((b) => b.x + b.w));
          const maxY = Math.max(...boxes.map((b) => b.y + b.h));

          return [
            {
              id: `frame:${slug}`,
              type: "seriesFrame" as const,
              position: {
                x: minX - FRAME_PADDING.x,
                y: minY - FRAME_PADDING.top,
              },
              data: {
                seriesName: members[0]!.data.seriesName,
                width: maxX - minX + FRAME_PADDING.x * 2,
                height: maxY - minY + FRAME_PADDING.top + FRAME_PADDING.bottom,
              } satisfies SeriesFrameData as unknown as Record<string, unknown>,
              draggable: false,
              connectable: false,
              selectable: false,
              focusable: false,
              // コースノードより後ろに敷く
              zIndex: -1,
            },
          ];
        })
      : [];

    const flowEdges: Edge[] = collapsible.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      // 順序辺・跨ぎ辺とも流れを見せる。区別は線種（実線 / 破線）が担う
      animated: true,
      className: [
        "dxm-edge",
        edge.kind === "cross" ? "dxm-edge-cross" : "dxm-edge-order",
      ].join(" "),
    }));

    return { nodes: [...frameNodes, ...courseNodes], edges: flowEdges };
  }, [collapsible, variant, direction, isGlobal, collapsedSlugs, locale]);

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
        style={{ height: canvasHeight }}
        // クリックするまではページスクロールを優先する
        onClick={() => setInteractive(true)}
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
        >
          <Background gap={20} />
          {isGlobal && <MiniMap pannable zoomable />}
          {interactive && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
    </div>
  );
}
