"use client";

import { useCallback, useMemo, useState } from "react";
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
  collapseSeries,
  courseView,
  globalView,
  resolveHereNodeId,
  terminalNodes,
  TERMINAL_PREFIX,
  type MandalaGraph,
} from "@/lib/mandala/graph";
import { layoutFlow, type LayoutSize } from "@/lib/mandala/layout";
import {
  mandalaNodeTypes,
  type MandalaNodeData,
  type SeriesFrameData,
} from "@/components/workspace/mandala/nodes";

const SIZES = {
  compact: { width: 200, height: 52 },
  // シリーズ名・コース名・「N レッスン・約 M 分」の 3 行＋右端ラベルが収まる
  // 必要十分な寸法。キャッチを載せないぶんサイトのカード（280×140）より小さい
  card: { width: 260, height: 96 },
  collapsedSeries: { width: 210, height: 72 },
  terminal: { width: 90, height: 30 },
} as const;

/** シリーズ枠がコース群の外へどれだけはみ出すか */
const FRAME_PADDING = { x: 22, top: 30, bottom: 18 };

/** 枠ノードの id 接頭辞。ミニマップから外すときの判別にも使う */
const FRAME_PREFIX = "frame:";

/** ノード数が少なくてもノードを実寸より拡大しない */
const FIT_VIEW_OPTIONS = { maxZoom: 1 } as const;

/**
 * 辺・矢印・接続点の丸ポチに共通の色。
 * SVG マーカーは CSS 変数を引けないので、辺側はここに直値で持つしかない。
 * ⚠ 丸ポチ側は `globals.css` の `--xy-handle-*` にあるので、変えるときは両方直す。
 */
const EDGE_COLOR = "#7a8189";

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

export type MandalaProps = {
  graph: MandalaGraph;
  /**
   * 全体（全シリーズ・シリーズ枠あり）か、1 コースの周辺だけか。
   * ミニ曼陀羅にシリーズ枠は出さない——囲む対象がほぼ 1 つで意味を持たないため。
   */
  scope: { kind: "global" } | { kind: "course"; courseId: string };
  /** ノードの密度。サムネイルは compact、拡大モーダルは card */
  variant: "compact" | "card";
  /** いま選んでいるコース。青枠＋ピンで示す */
  currentCourseId?: string | null;
  height?: number | string;
  onSelectCourse?: (courseId: string) => void;
  /** サムネイル用: パン・ズーム・ノードクリックを一切受けない */
  staticView?: boolean;
  /** 全体曼陀羅のみ: シリーズ折りたたみとミニマップを出す */
  showChrome?: boolean;
};

export function Mandala({
  graph,
  scope,
  variant,
  currentCourseId = null,
  height = 560,
  onSelectCourse,
  staticView = false,
  showChrome = false,
}: MandalaProps) {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [interactive, setInteractive] = useState(false);

  const isGlobal = scope.kind === "global";

  const view = useMemo(
    () =>
      scope.kind === "global"
        ? globalView(graph)
        : courseView(graph, scope.courseId),
    [graph, scope],
  );

  const collapsible = useMemo(
    () =>
      isGlobal
        ? collapseSeries(view, collapsedIds)
        : { ...view, collapsed: [] },
    [view, collapsedIds, isGlobal],
  );

  const { nodes, edges } = useMemo(() => {
    // 折りたたみ中は現在地のコースが消えるので、印は集約ノードへ移る
    const hereNodeId = resolveHereNodeId(
      view,
      collapsible.collapsed,
      currentCourseId,
    );

    // Start / Goal は全体曼陀羅だけに置く。畳まれたシリーズのコースが宣言して
    // いるときは、辺を集約ノードへ繋ぎ替える
    const collapsedIdBySeries = new Map(
      collapsible.collapsed.map((c) => [c.seriesId, c.id]),
    );
    const { terminals, edges: terminalEdges } = isGlobal
      ? terminalNodes(view.nodes, (courseId) => {
          const node = view.nodes.find((n) => n.id === courseId);
          return (node && collapsedIdBySeries.get(node.seriesId)) ?? courseId;
        })
      : { terminals: [], edges: [] };

    // 接続点の丸ポチは「辺が出ていく側」にだけ出す
    const outgoing = new Set(
      [...collapsible.edges, ...terminalEdges].map((edge) => edge.source),
    );

    const entries: Array<{
      id: string;
      type: keyof typeof SIZES;
      data: MandalaNodeData;
      seriesId: string;
    }> = [
      ...collapsible.nodes.map((node) => ({
        id: node.id,
        type: variant as keyof typeof SIZES,
        seriesId: node.seriesId,
        data: {
          label: node.label,
          seriesName: node.seriesName,
          lessonCount: node.lessonCount,
          totalMinutes: node.totalMinutes,
          style: node.style,
          ghost: node.ghost,
          current: node.current,
          here: node.id === hereNodeId,
          hasOutgoing: outgoing.has(node.id),
        } satisfies MandalaNodeData,
      })),
      ...collapsible.collapsed.map((series) => ({
        id: series.id,
        type: "collapsedSeries" as const,
        seriesId: series.seriesId,
        data: {
          label: series.seriesName,
          seriesName: series.seriesName,
          lessonCount: series.lessonCount,
          totalMinutes: series.totalMinutes,
          ghost: false,
          current: false,
          here: series.id === hereNodeId,
          hasOutgoing: outgoing.has(series.id),
          collapsed: { courseCount: series.courseCount },
        } satisfies MandalaNodeData,
      })),
    ];

    const typeById = new Map<string, keyof typeof SIZES>([
      ...entries.map((e) => [e.id, e.type] as const),
      ...terminals.map((t) => [t.id, "terminal"] as const),
    ]);
    const sizeOf = (id: string): LayoutSize =>
      SIZES[typeById.get(id) ?? variant];

    const positions = layoutFlow(
      [...entries.map((e) => e.id), ...terminals.map((t) => t.id)],
      [...collapsible.edges, ...terminalEdges],
      { size: SIZES[variant], sizeOf },
    );
    const positionById = new Map(positions.map((p) => [p.id, p]));

    const terminalFlowNodes: Node[] = terminals.map((terminal) => ({
      id: terminal.id,
      type: "terminal" as const,
      position: positionById.get(terminal.id) ?? { x: 0, y: 0 },
      ...SIZES.terminal,
      data: {
        label: terminal.kind === "start" ? "Start" : "Goal",
        // Goal からは辺が出ていかないので、下辺の点は出さない
        hasOutgoing: outgoing.has(terminal.id),
      },
      draggable: false,
      connectable: false,
      selectable: false,
      focusable: false,
    }));

    const courseNodes: Node[] = entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      position: positionById.get(entry.id) ?? { x: 0, y: 0 },
      // ミニマップは実測値ではなくノードの寸法を見るので、確定値を明示する
      ...sizeOf(entry.id),
      data: entry.data as unknown as Record<string, unknown>,
      draggable: false,
      connectable: false,
    }));

    // シリーズ枠は全体曼陀羅だけ。React Flow の親子関係は使わない——dagre の
    // 絶対座標と二重管理になるため、レイアウト結果から矩形を求めて背後に敷く
    const framedSeriesIds = isGlobal
      ? [...new Set(entries.map((e) => e.seriesId))]
      : [];

    const frameNodes: Node[] = framedSeriesIds.flatMap((seriesId) => {
      // 折りたたみ中のシリーズは集約ノード 1 つなので枠を描かない
      if (collapsedIds.has(seriesId)) return [];
      const members = entries.filter((e) => e.seriesId === seriesId);
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
      const frameHeight = maxY - minY + FRAME_PADDING.top + FRAME_PADDING.bottom;

      return [
        {
          id: `${FRAME_PREFIX}${seriesId}`,
          type: "seriesFrame" as const,
          position: { x: minX - FRAME_PADDING.x, y: minY - FRAME_PADDING.top },
          width,
          height: frameHeight,
          data: {
            seriesName: members[0]!.data.seriesName,
            width,
            height: frameHeight,
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

    // ⚠ 順序辺と跨ぎ辺を線種で区別しない。animated な辺はそれ自体が
    // 流れる破線として描かれるため、跨ぎだけ dasharray を変えても目視できず、
    // 区別を主張するコードとコメントが実態と食い違うだけになる
    const flowEdges: Edge[] = [
      ...collapsible.edges,
      ...terminalEdges,
    ].map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: true,
      // 進む方向を指す矢印。色は線に揃える（既定は薄いグレーで線から浮く）
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: EDGE_COLOR,
      },
      style: { stroke: EDGE_COLOR },
      className: "dxm-edge",
    }));

    return {
      nodes: [...frameNodes, ...courseNodes, ...terminalFlowNodes],
      edges: flowEdges,
    };
  }, [
    view,
    collapsible,
    variant,
    isGlobal,
    collapsedIds,
    currentCourseId,
  ]);

  const courseIds = useMemo(
    () => new Set(collapsible.nodes.map((n) => n.id)),
    [collapsible],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (staticView) return;
      if (courseIds.has(node.id)) onSelectCourse?.(node.id);
    },
    [courseIds, onSelectCourse, staticView],
  );

  const seriesList = useMemo(
    () =>
      [...new Map(graph.nodes.map((n) => [n.seriesId, n.seriesName])).entries()],
    [graph],
  );

  const toggleSeries = (seriesId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);
      return next;
    });
  };

  if (nodes.length === 0) return null;

  const canPan = !staticView && interactive;

  return (
    <div className="dxm-mandala">
      {showChrome && (
        <div className="dxm-mandala-toolbar">
          {seriesList.map(([seriesId, seriesName]) => {
            const collapsed = collapsedIds.has(seriesId);
            return (
              <button
                key={seriesId}
                type="button"
                className="dxm-mandala-toggle"
                aria-pressed={collapsed}
                onClick={() => toggleSeries(seriesId)}
              >
                {collapsed ? "▸" : "▾"} {seriesName}
              </button>
            );
          })}
        </div>
      )}
      <div
        className="dxm-mandala-canvas"
        style={{ height }}
        // クリックするまではスクロールを優先する
        onClick={() => {
          if (!staticView) setInteractive(true);
        }}
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
          zoomOnScroll={canPan}
          preventScrolling={canPan}
          panOnDrag={canPan}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          onNodeClick={onNodeClick}
        >
          {/* 背景の格子は敷かない。ミニマップ・Controls の配色は globals.css の
              `--xy-*` が持つ（props で渡すとインラインになり上書きできない） */}
          {showChrome && (
            <MiniMap pannable zoomable nodeComponent={MandalaMiniMapNode} />
          )}
          {canPan && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
    </div>
  );
}
