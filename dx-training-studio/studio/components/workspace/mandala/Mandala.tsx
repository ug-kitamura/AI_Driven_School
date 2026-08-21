"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Controls,
  MarkerType,
  MiniMap,
  MiniMapNode,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  collapseSeries,
  COLLAPSED_PREFIX,
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
  // ミニ曼陀羅サムネイル。受講形態を載せないぶん compact より狭くできる。
  // ⚠ 狭いほうがよいのは、fitView が狭いグラフを大きい倍率で描くため
  // ——ノードを実寸で広く取ると、そのぶん縮小されてコース名が小さくなる。
  // ⚠ `globals.css` の `.dxm-node-thumbnail` と必ず同時に直すこと
  thumbnail: { width: 160, height: 52 },
  // シリーズ名・コース名・「N レッスン・約 M 分」の 3 行＋右端ラベルが収まる
  // 必要十分な寸法。キャッチを載せないぶんサイトのカード（280×140）より小さい。
  // ⚠ `globals.css` の `.dxm-node-card` と必ず同時に直すこと——dagre は固定寸法を
  // 前提に座標を出すので、片方だけ変えると辺の接続位置がノードの縁からずれる
  card: { width: 230, height: 88 },
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
 * ノードの実測が揃った時点で 1 度だけ中心へ合わせ直す。
 *
 * ⚠ `fitView` の boolean prop は「初期化時」に走るが、**その時点ではノードの
 * 実測（`measured`）が揃っていないことがある**。揃う前の寸法で計算した位置は
 * そのまま残るため、**モーダルを開いた最初の 1 回だけ中心がずれる**という形で出る
 * （2026-08-21 に実機で報告された）。ノード数・寸法が変わらない再描画では
 * 再フィットされないので、コンテナのリサイズ監視だけでは埋まらない。
 *
 * ⚠ `<ReactFlow>` の子として置くこと——React Flow が内部で張るコンテキストの
 * 内側でないと `useReactFlow` / `useNodesInitialized` が使えない。
 */
function FitWhenNodesInitialized({ enabled }: { enabled: boolean }) {
  const initialized = useNodesInitialized();
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!initialized || !enabled) return;
    // 観測と同一フレームで viewport を変えない
    const frame = requestAnimationFrame(() => {
      void fitView(FIT_VIEW_OPTIONS);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialized, enabled, fitView]);

  return null;
}

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
  /**
   * いま選んでいるシリーズ。コース未選択のときだけ意味を持ち、
   * そのシリーズ枠が現在地になる（コースの選択が優先）。
   */
  currentSeriesId?: string | null;
  /**
   * キャンバスの高さ。**CSS の絶対長だけ**を渡すこと（`720` / `"min(74vh, 720px)"`）。
   * ⚠ `"100%"` のようなパーセントを渡してはならない——ラッパの高さが確定して
   * いないので解決できず、キャンバスが 0px に潰れる。親いっぱいに広げたいときは `fill`
   */
  height?: number | string;
  /**
   * 親の高さいっぱいに広げる。`height` は無視される。
   * ツールバーを持つ面でも溢れないよう、キャンバス側が残りの高さを取る
   * （規則は `globals.css` の `.dxm-mandala-fill`）
   */
  fill?: boolean;
  onSelectCourse?: (courseId: string) => void;
  /** シリーズ枠のクリック。全体曼陀羅のみ（ミニ曼陀羅に枠は無い） */
  onSelectSeries?: (seriesId: string) => void;
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
  currentSeriesId = null,
  height = 560,
  fill = false,
  onSelectCourse,
  onSelectSeries,
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

    // 全体曼陀羅は宣言している全てのコースに Start / Goal を置く。畳まれた
    // シリーズのコースが宣言しているときは、辺を集約ノードへ繋ぎ替える。
    //
    // ミニ曼陀羅は**中心コース自身の宣言だけ**を拾う——映しているのは中心と
    // その隣接 1 段なので、隣のコースの宣言まで拾うと「2 段先」の情報が混じる。
    // 例: 入口のコースを開けば 1 個前として Start が出るが、その次のコースを
    // 開いたときは 1 個前のコースだけが出て、その手前の Start は出ない。
    const collapsedIdBySeries = new Map(
      collapsible.collapsed.map((c) => [c.seriesId, c.id]),
    );
    const terminalSources =
      scope.kind === "global"
        ? view.nodes
        : view.nodes.filter((n) => n.id === scope.courseId);
    const { terminals, edges: terminalEdges } = terminalNodes(
      terminalSources,
      (courseId) => {
        const node = view.nodes.find((n) => n.id === courseId);
        return (node && collapsedIdBySeries.get(node.seriesId)) ?? courseId;
      },
    );

    // 接続点の丸ポチは「辺が出ていく側」にだけ出す
    const outgoing = new Set(
      [...collapsible.edges, ...terminalEdges].map((edge) => edge.source),
    );

    // シリーズ自身を選んでいるときは、そのシリーズ枠が現在地になる。
    // ⚠ コースの選択が優先——コースを選ぶと所属シリーズも選択状態になるので、
    // 両方に印が付くと「いまここ」が 2 つあるように見える。
    // 折りたたみ中は枠が無いので、印は下の集約ノードが引き取る
    const hereSeriesId = hereNodeId ? null : (currentSeriesId ?? null);

    // ⚠ `variant === "compact"` は全体曼陀羅と共通なので、scope と組で判定すること。
    // サムネイルは密度が違う（幅が狭い・受講形態を載せない・コース名を中央ぞろえ）
    // ので、ノード種別そのものを分ける
    const nodeVariant: keyof typeof SIZES =
      scope.kind === "course" && variant === "compact" ? "thumbnail" : variant;

    // 受講形態のラベルはサムネイルには載せない——セルが小さく、ラベルがコース名の
    // 幅を奪って省略が早く始まる。周辺の並びだけ分かればよい面なので、
    // 受講形態は拡大モーダル（card）と全体曼陀羅（compact）に任せる
    const showStyle = nodeVariant !== "thumbnail";

    const entries: Array<{
      id: string;
      type: keyof typeof SIZES;
      data: MandalaNodeData;
      seriesId: string;
    }> = [
      ...collapsible.nodes.map((node) => ({
        id: node.id,
        type: nodeVariant,
        seriesId: node.seriesId,
        data: {
          label: node.label,
          seriesName: node.seriesName,
          lessonCount: node.lessonCount,
          totalMinutes: node.totalMinutes,
          style: showStyle ? node.style : undefined,
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
          // 畳まれたシリーズは枠を持たないので、シリーズ自身の現在地も引き取る
          here: series.id === hereNodeId || series.seriesId === hereSeriesId,
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
      SIZES[typeById.get(id) ?? nodeVariant];

    const positions = layoutFlow(
      [...entries.map((e) => e.id), ...terminals.map((t) => t.id)],
      [...collapsible.edges, ...terminalEdges],
      { size: SIZES[nodeVariant], sizeOf },
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
            here: seriesId === hereSeriesId,
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
    scope,
    isGlobal,
    collapsedIds,
    currentCourseId,
    currentSeriesId,
  ]);

  const courseIds = useMemo(
    () => new Set(collapsible.nodes.map((n) => n.id)),
    [collapsible],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (staticView) return;
      if (courseIds.has(node.id)) {
        onSelectCourse?.(node.id);
        return;
      }
      // シリーズ枠はそのシリーズを選ぶ。枠の中でもコースノードの上ではコースが
      // 優先される——z-index で決まっており（コース 0 / 枠 -1）、上の分岐に入る
      if (node.id.startsWith(FRAME_PREFIX)) {
        onSelectSeries?.(node.id.slice(FRAME_PREFIX.length));
        return;
      }
      // 折りたたんだシリーズの集約ノードも同じくシリーズを選ぶ
      // ——展開時の枠と畳んだときの集約は同じシリーズの 2 つの姿なので、
      // クリックの意味も揃える
      if (node.id.startsWith(COLLAPSED_PREFIX)) {
        onSelectSeries?.(node.id.slice(COLLAPSED_PREFIX.length));
      }
    },
    [courseIds, onSelectCourse, onSelectSeries, staticView],
  );

  const seriesList = useMemo(
    () =>
      [...new Map(graph.nodes.map((n) => [n.seriesId, n.seriesName])).entries()],
    [graph],
  );

  /**
   * コンテナの寸法が確定したとき・変わったときに曼陀羅を中心へ収め直す。
   *
   * ⚠ `fitView` の boolean prop は**初期化時の一度きり**で、options では変えられない。
   * モーダルは開いた直後にフレックスがキャンバスを縮めることがあり、初回フィット時の
   * 寸法と最終的な寸法が食い違ったぶんがそのままずれとして残っていた。
   */
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReactFlowInstance | null>(null);
  // 監視を張り替えずにコールバックから読むためのミラー
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      // ⚠ 寸法の観測と同一フレームで viewport を変えない
      // （"ResizeObserver loop completed with undelivered notifications" が出る）
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // パン・ズームを始めたあとに合わせ直すと操作を巻き戻すことになる。
        // サムネイル（staticView）は操作を受けないので常に合わせ直してよい
        if (!staticView && interactiveRef.current) return;
        instanceRef.current?.fitView(FIT_VIEW_OPTIONS);
      });
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [staticView]);

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
    <div className={fill ? "dxm-mandala dxm-mandala-fill" : "dxm-mandala"}>
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
        ref={canvasRef}
        className="dxm-mandala-canvas"
        // fill のときは高さを CSS（`.dxm-mandala-fill`）が決める
        style={fill ? undefined : { height }}
        // クリックするまではスクロールを優先する
        onClick={() => {
          if (!staticView) setInteractive(true);
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={mandalaNodeTypes}
          // 初回のフィット。以降の追随は上の ResizeObserver が担う
          // （経路を二重化しないよう、初回はこちらに任せたままにする）
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          onInit={(instance) => {
            instanceRef.current = instance;
          }}
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
          {/* パン・ズームを始めたあとは合わせ直さない（操作を巻き戻さない）。
              サムネイルは操作を受けないので常に合わせてよい */}
          <FitWhenNodesInitialized enabled={staticView || !interactive} />
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
