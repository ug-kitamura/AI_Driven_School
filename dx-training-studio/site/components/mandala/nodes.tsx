"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MapPin } from "lucide-react";
import { formatCourseStyle, type CourseStyle } from "@/lib/site-data";
import type { Locale } from "@/lib/locale-path";

export type MandalaNodeData = {
  label: string;
  href: string;
  seriesName: string;
  catch?: string;
  lessonCount: number;
  totalMinutes: number;
  /** コースの受講形態。未設定ならラベルを出さない */
  style?: CourseStyle;
  locale: Locale;
  ghost: boolean;
  current: boolean;
  /**
   * 読者がいまいるコース。`current`（scope 内かどうか）とは別物で、
   * モーダルがパスから解いた1件だけに立つ。
   */
  here: boolean;
  /** 折りたたまれたシリーズの集約ノード */
  collapsed?: { courseCount: number };
};

/** シリーズごとにコース群を囲う背景枠（全体曼陀羅のみ） */
export type SeriesFrameData = {
  seriesName: string;
  width: number;
  height: number;
};

function classNames(...values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function nodeClass(data: MandalaNodeData, variant: string): string {
  return classNames(
    "dxm-node",
    `dxm-node-${variant}`,
    data.ghost && "dxm-node-ghost",
    data.current && "dxm-node-current",
    data.here && "dxm-node-here",
  );
}

/**
 * 「いまここ」の印。ノードの左外・高さ中央へ絶対配置で重ねる——
 * インラインで置くとコース名の幅が縮み、ellipsis の位置が他ノードとずれる。
 * 寸法 20 はシリーズ枠線との隙間（22px）から決まる。理由は
 * `globals.css` の `.dxm-node-here-pin` を参照。
 */
function HerePin({ data }: { data: MandalaNodeData }) {
  if (!data.here) return null;
  return (
    <MapPin
      className="dxm-node-here-pin"
      size={20}
      strokeWidth={2.5}
      aria-label={data.locale === "en" ? "You are here" : "いまここ"}
    />
  );
}

function StyleLabel({ data }: { data: MandalaNodeData }) {
  const label = formatCourseStyle(data.style, data.locale);
  if (!label) return null;
  return <span className="dxm-node-style">{label}</span>;
}

/** 全体・シリーズ曼陀羅用。コース名と受講形態だけ——数が増えても一覧できるように */
export function CompactNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  return (
    <div
      className={nodeClass(d, "compact")}
      title={`${d.seriesName} / ${d.label}`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <HerePin data={d} />
      <span className="dxm-node-title">{d.label}</span>
      <StyleLabel data={d} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

/** ミニ曼陀羅（コーストップ）用。目次として読めるだけの情報を載せる */
export function CardNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  return (
    <div className={nodeClass(d, "card")}>
      {/* 縦に流れるので接続点は上下 */}
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {d.current && <span className="dxm-node-pin">いまここ</span>}
      {d.ghost && <span className="dxm-node-series">{d.seriesName}</span>}
      <span className="dxm-node-title">{d.label}</span>
      {d.catch && <span className="dxm-node-catch">{d.catch}</span>}
      <span className="dxm-node-meta">
        {d.lessonCount} レッスン・約 {d.totalMinutes} 分
        <StyleLabel data={d} />
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

/** 折りたたんだシリーズ1つ分 */
export function CollapsedSeriesNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  return (
    <div className={nodeClass(d, "collapsed")}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {/* 折りたたんでも現在地を見失わないよう、コースノードと同じ印を出す */}
      <HerePin data={d} />
      <span className="dxm-node-title">{d.label}</span>
      <span className="dxm-node-meta">
        {d.collapsed?.courseCount ?? 0} コース・{d.lessonCount} レッスン
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

/** コース群の背後に敷く枠。クリックを奪わない */
export function SeriesFrameNode({ data }: NodeProps) {
  const d = data as unknown as SeriesFrameData;
  return (
    <div
      className="dxm-series-frame"
      style={{ width: d.width, height: d.height }}
    >
      <span className="dxm-series-frame-label">{d.seriesName}</span>
    </div>
  );
}

/** Start / Goal の文字ノード。枠も地色も持たず「ノードに見えない」ようにする */
export type TerminalNodeData = { label: string };

export function TerminalNode({ data }: NodeProps) {
  const d = data as unknown as TerminalNodeData;
  return (
    <div className="dxm-terminal">
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {d.label}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

export const mandalaNodeTypes = {
  compact: CompactNode,
  card: CardNode,
  collapsedSeries: CollapsedSeriesNode,
  seriesFrame: SeriesFrameNode,
  terminal: TerminalNode,
};
