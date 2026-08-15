"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Controls,
  MarkerType,
  MiniMap,
  MiniMapNode,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  buildView,
  collapseSeries,
  terminalNodes,
  TERMINAL_PREFIX,
  type MandalaScope,
} from "@/lib/mandala/graph";
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
  terminal: { width: 90, height: 30 },
} as const;

/** シリーズ枠がコース群の外へどれだけはみ出すか */
const FRAME_PADDING = { x: 22, top: 30, bottom: 18 };

/** 枠ノードの id 接頭辞。ミニマップから外すときの判別にも使う */
const FRAME_PREFIX = "frame:";

/** ノード数が少なくてもカードを実寸より拡大しない */
const FIT_VIEW_OPTIONS = { maxZoom: 1 } as const;

/** 辺と矢印の色。SVG マーカーは CSS 変数を引けないので、両テーマで読める中間グレーを使う */
const EDGE_COLOR = "#9aa0a6";

/**
 * ミニマップは枠を描かない——枠はコース群と重なる大きな矩形なので、
 * そのまま出すと全面が塗り潰されてコースの配置が読めなくなる。
 */
function MandalaMiniMapNode(props: React.ComponentProps<typeof MiniMapNode>) {
  if (props.id.startsWith(FRAME_PREFIX)) return null;
  // Start / Goal も描かない——地図の目印であってコースではない
  if (props.id.startsWith(TERMINAL_PREFIX)) return null;
  return <MiniMapNode {...props} />;
}

type ScopeStyle = {
  variant: "compact" | "card";
  direction: LayoutDirection;
  height: number;
  /** 段と段の間隔。既定（72）だと収まらない場合に締める */
  rankSep?: number;
};

/** 見た目は scope で決まる。全体・シリーズは一覧性、コースは読み物としての大きさ */
function styleOf(scope: MandalaScope): ScopeStyle {
  switch (scope.kind) {
    case "global":
      return { variant: "compact", direction: "TB", height: 640 };
    case "series":
      return { variant: "compact", direction: "TB", height: 640 };
    case "course":
      // 縦3段（カード 140 × 3 ＋ 段間 48 × 2 ＝ 516）が高さ 580 に
      // ズーム1のまま収まるよう、段間を既定の 72 から締める
      return { variant: "card", direction: "TB", height: 580, rankSep: 48 };
  }
}

export type MandalaProps = {
  scope: MandalaScope;
  locale?: Locale;
  /** 既定の高さを上書きする（scope ごとの既定は styleOf）。モーダルは vh で渡す */
  height?: number | string;
  /**
   * 「いまここ」を出すコース。モーダルがパスから解いて渡す。
   * ViewNode の `current`（scope 内かどうか）とは別の意味なので独立して持つ。
   */
  currentCourseId?: string | null;
};

export function Mandala({
  scope,
  locale = "ja",
  height,
  currentCourseId = null,
}: MandalaProps) {
  const router = useRouter();
  const [collapsedSlugs, setCollapsedSlugs] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [interactive, setInteractive] = useState(false);

  const isGlobal = scope.kind === "global";
  const {
    variant,
    direction,
    height: defaultHeight,
    rankSep,
  } = styleOf(scope);
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
          here: node.id === currentCourseId,
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
          here: false,
          collapsed: { courseCount: series.courseCount },
        } satisfies MandalaNodeData,
      })),
    ];

    // Start / Goal は全体曼陀羅だけに置く。畳まれたシリーズのコースが宣言している
    // ときは、辺を集約ノードへ繋ぎ替える
    const collapsedIdBySlug = new Map(
      collapsible.collapsed.map((c) => [c.seriesSlug, c.id]),
    );
    const { terminals, edges: terminalEdges } = isGlobal
      ? terminalNodes(view.nodes, (courseId) => {
          const node = view.nodes.find((n) => n.id === courseId);
          return (
            (node && collapsedIdBySlug.get(node.seriesSlug)) ?? courseId
          );
        })
      : { terminals: [], edges: [] };

    const typeById = new Map<string, keyof typeof SIZES>([
      ...entries.map((e) => [e.id, e.type] as const),
      ...terminals.map((t) => [t.id, "terminal"] as const),
    ]);
    const sizeOf = (id: string): LayoutSize =>
      SIZES[typeById.get(id) ?? variant];

    const positions = layoutFlow(
      [...entries.map((e) => e.id), ...terminals.map((t) => t.id)],
      [...collapsible.edges, ...terminalEdges],
      { size: SIZES[variant], direction, rankSep, sizeOf },
    );
    const positionById = new Map(positions.map((p) => [p.id, p]));

    const terminalFlowNodes: Node[] = terminals.map((terminal) => ({
      id: terminal.id,
      type: "terminal" as const,
      position: positionById.get(terminal.id) ?? { x: 0, y: 0 },
      ...SIZES.terminal,
      data: { label: terminal.kind === "start" ? "Start" : "Goal" },
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
    }));

    const courseNodes: Node[] = entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      position: positionById.get(entry.id) ?? { x: 0, y: 0 },
      // ミニマップは実測値ではなくノードの寸法を見るので、確定している値を明示する
      ...sizeOf(entry.id),
      data: entry.data as unknown as Record<string, unknown>,
      draggable: false,
      connectable: false,
    }));

    // シリーズごとのコース群を背景の枠で囲う。全体曼陀羅は全シリーズ、
    // シリーズ曼陀羅は表示中のシリーズだけ（シリーズ外のゴーストは囲わない）。
    // React Flow の親子関係は使わない——dagre の絶対座標と二重管理になるため、
    // レイアウト結果から矩形を求めて背後に敷くだけにする。
    const framedSlugs = isGlobal
      ? [...new Set(entries.map((e) => e.seriesSlug))]
      : scope.kind === "series"
        ? [scope.seriesSlug]
        : [];

    const frameNodes: Node[] = framedSlugs.flatMap((slug) => {
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

      const width = maxX - minX + FRAME_PADDING.x * 2;
      const height = maxY - minY + FRAME_PADDING.top + FRAME_PADDING.bottom;

      return [
        {
          id: `${FRAME_PREFIX}${slug}`,
          type: "seriesFrame" as const,
          position: {
            x: minX - FRAME_PADDING.x,
            y: minY - FRAME_PADDING.top,
          },
          width,
          height,
          data: {
            seriesName: members[0]!.data.seriesName,
            width,
            height,
          } satisfies SeriesFrameData as unknown as Record<string, unknown>,
          draggable: false,
          connectable: false,
          selectable: false,
          focusable: false,
          // コースノードより後ろに敷く
          zIndex: -1,
        },
      ];
    });

    const flowEdges: Edge[] = [...collapsible.edges, ...terminalEdges].map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      // 順序辺・跨ぎ辺とも流れを見せる。区別は線種（実線 / 破線）が担う
      animated: true,
      // 進む方向を指す矢印。色は線に揃える（既定は薄いグレーで線から浮く）
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: EDGE_COLOR,
      },
      style: { stroke: EDGE_COLOR },
      className: [
        "dxm-edge",
        edge.kind === "cross" ? "dxm-edge-cross" : "dxm-edge-order",
      ].join(" "),
    }));

    return {
      nodes: [...frameNodes, ...courseNodes, ...terminalFlowNodes],
      edges: flowEdges,
    };
  }, [
    view,
    collapsible,
    scope,
    variant,
    direction,
    rankSep,
    isGlobal,
    collapsedSlugs,
    locale,
    currentCourseId,
  ]);

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
          fitViewOptions={FIT_VIEW_OPTIONS}
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
          {/* 背景の格子は敷かない——曼陀羅を本文から浮かせず地続きに見せる。
              ミニマップ・Controls の配色は globals.css の `--xy-*` が持つ
              （props で渡すとインラインになり、ダークから上書きできない） */}
          {isGlobal && (
            <MiniMap pannable zoomable nodeComponent={MandalaMiniMapNode} />
          )}
          {interactive && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
    </div>
  );
}
