"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Controls,
  MarkerType,
  MiniMap,
  MiniMapNode,
  ReactFlow,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  globalView,
  collapseSeries,
  isSeriesFrameHere,
  resolveHereNodeId,
  terminalNodes,
  TERMINAL_PREFIX,
} from "@/lib/mandala/graph";
import type { CurrentLocation } from "@/lib/current-course";
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
import { data as siteData, localized } from "@/lib/site-data";
import { localizedHref, type Locale } from "@/lib/locale-path";

const SIZES = {
  compact: { width: 240, height: 72 },
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

/**
 * 辺・矢印・接続点の丸ポチに共通の色。
 *
 * SVG マーカーは CSS 変数を引けないので、辺側はここに直値で持つしかない。
 * ⚠ **丸ポチ側は `globals.css` の `--xy-handle-*` にあるので、変えるときは両方直す。**
 *
 * 値は「ライトの地（≒ #f7f7f7）とダークの地（≒ #1a1a1a）に対して同じくらいの
 * コントラストになる明度」から決めている（相対輝度 ≒ 0.21 → どちらも約 4:1）。
 * 片方に寄せると、もう片方のテーマで沈むか浮くかする。
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

/** 全体曼陀羅は一覧性を優先して compact ノードで描く */
const VARIANT = "compact" as const;
const DEFAULT_HEIGHT = 640;

export type MandalaProps = {
  scope: { kind: "global" };
  locale?: Locale;
  /** 既定の高さを上書きする。モーダルは vh で渡す */
  height?: number | string;
  /**
   * 「いまここ」を出す位置（コースまたはシリーズ）。モーダルがパスから解いて渡す。
   * ViewNode の `current`（scope 内かどうか）とは別の意味なので独立して持つ。
   */
  currentLocation?: CurrentLocation | null;
};

export function Mandala({
  scope,
  locale = "ja",
  height,
  currentLocation = null,
}: MandalaProps) {
  const router = useRouter();
  const [collapsedSlugs, setCollapsedSlugs] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [interactive, setInteractive] = useState(false);

  const variant = VARIANT;
  const canvasHeight = height ?? DEFAULT_HEIGHT;

  const view = useMemo(() => globalView(siteData.mandala), []);
  const collapsible = useMemo(
    () => collapseSeries(view, collapsedSlugs),
    [view, collapsedSlugs],
  );

  const { nodes, edges } = useMemo(() => {
    // 折りたたみ中は現在地のコースが消えるので、印は集約ノードへ移る。
    // コースノードと集約ノードをこの1つの ID と突き合わせれば足りる
    const hereNodeId = resolveHereNodeId(
      view,
      collapsible.collapsed,
      currentLocation,
    );

    // Start / Goal は全体曼陀羅だけに置く。畳まれたシリーズのコースが宣言している
    // ときは、辺を集約ノードへ繋ぎ替える
    const collapsedIdBySlug = new Map(
      collapsible.collapsed.map((c) => [c.seriesSlug, c.id]),
    );
    const { terminals, edges: terminalEdges } = terminalNodes(
      view.nodes,
      (courseId) => {
        const node = view.nodes.find((n) => n.id === courseId);
        return (node && collapsedIdBySlug.get(node.seriesSlug)) ?? courseId;
      },
    );

    // 接続点の丸ポチは「辺が出ていく側」にだけ出す。どこにも繋がっていない点は
    // 意味を持たないので消す——判定に辺の一覧が要るため CSS では書けない
    const outgoing = new Set(
      [...collapsible.edges, ...terminalEdges].map((edge) => edge.source),
    );

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
          // 英語ロケールでは英語名。未訳は日本語名へフォールバックする
          // （ページ側の名前表示と同じ規則。止めると名無しだらけになる）
          label: localized(node.label, node.labelEn, locale),
          href: node.href,
          seriesName: localized(node.seriesName, node.seriesNameEn, locale),
          catch: node.catch,
          lessonCount: node.lessonCount,
          totalMinutes: node.totalMinutes,
          style: node.style,
          locale,
          ghost: node.ghost,
          current: node.current,
          here: node.id === hereNodeId,
          hasOutgoing: outgoing.has(node.id),
        } satisfies MandalaNodeData,
      })),
      ...collapsible.collapsed.map((series) => ({
        id: series.id,
        type: "collapsedSeries" as const,
        seriesSlug: series.seriesSlug,
        data: {
          label: localized(series.seriesName, series.seriesNameEn, locale),
          href: series.href,
          seriesName: localized(
            series.seriesName,
            series.seriesNameEn,
            locale,
          ),
          lessonCount: series.lessonCount,
          totalMinutes: series.totalMinutes,
          locale,
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
    const framedSlugs = [...new Set(entries.map((e) => e.seriesSlug))];

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
            // 展開中のシリーズトップを見ているときは枠が現在地になる
            here: isSeriesFrameHere(currentLocation, slug),
            locale,
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
      // 順序辺・跨ぎ辺とも流れを見せる。
      // ⚠ 線種で区別しないこと——animated な辺はそれ自体が流れる破線として
      // 描かれるため、跨ぎだけ dasharray を変えても目視できず、区別を主張する
      // コードとコメントが実態と食い違うだけになる
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
    collapsedSlugs,
    locale,
    currentLocation,
  ]);

  const hrefById = useMemo(
    () =>
      new Map<string, string>([
        ...collapsible.nodes.map((n) => [n.id, n.href] as const),
        ...collapsible.collapsed.map((s) => [s.id, s.href] as const),
        // 展開中のシリーズ枠もシリーズトップへ飛ばす。当たり判定は触らない
        // ——枠の wrapper は `onNodeClick` を渡した時点で React Flow が
        // `pointer-events: all` にしており、すでにクリックを受け取れる。
        // 「コースノードの上ではコースへ」は z-index が自動でやる（コース 0 / 枠 -1）
        ...[...new Set(collapsible.nodes.map((n) => n.seriesSlug))].map(
          (slug) => [`${FRAME_PREFIX}${slug}`, `/${slug}`] as const,
        ),
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

  /**
   * コンテナの寸法が確定したとき・変わったときに曼陀羅を中心へ収め直す。
   *
   * ⚠ `fitView` の boolean prop は**初期化時の一度きり**で、options では変えられない。
   * ウィンドウのリサイズやレイアウトの落ち着きでキャンバスの寸法が後から変わると、
   * 初回フィット時の寸法との差がそのままずれとして残る。
   * ⚠ Studio 側（`studio/components/workspace/mandala/Mandala.tsx`）に同じ手当がある。
   * 相互依存禁止の規約によりコピーで持つので、直すときは両方直す。
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
        // パン・ズームを始めたあとに合わせ直すと閲覧者の操作を巻き戻すことになる
        if (interactiveRef.current) return;
        instanceRef.current?.fitView(FIT_VIEW_OPTIONS);
      });
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

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
      <div className="dxm-mandala-toolbar">
          {seriesSlugs.map((slug) => {
            const collapsed = collapsedSlugs.has(slug);
            const node = siteData.mandala.nodes.find(
              (n) => n.seriesSlug === slug,
            );
            const name = node
              ? localized(node.seriesName, node.seriesNameEn, locale)
              : slug;
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
      <div
        ref={canvasRef}
        className="dxm-mandala-canvas"
        style={{ height: canvasHeight }}
        // クリックするまではページスクロールを優先する
        onClick={() => setInteractive(true)}
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
          {(
            <MiniMap pannable zoomable nodeComponent={MandalaMiniMapNode} />
          )}
          {interactive && <Controls showInteractive={false} />}
        </ReactFlow>
      </div>
    </div>
  );
}
