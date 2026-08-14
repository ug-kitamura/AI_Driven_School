"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { LessonStatus } from "@/lib/site-data";

export type MandalaNodeData = {
  label: string;
  href: string;
  seriesName: string;
  catch?: string;
  lessonCount: number;
  totalMinutes: number;
  status: LessonStatus;
  ghost: boolean;
  current: boolean;
  /** ホバートレースで減光する */
  dimmed: boolean;
  /** 折りたたまれたシリーズの集約ノード */
  collapsed?: { courseCount: number };
};

const STATUS_LABEL: Record<LessonStatus, string | null> = {
  done: null,
  in_progress: "執筆中",
  open: "未着手",
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
    data.dimmed && "dxm-node-dimmed",
  );
}

/** グローバル曼陀羅用。コース名と状態だけ——数が増えても一覧できるように */
export function CompactNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  return (
    <div
      className={nodeClass(d, "compact")}
      title={`${d.seriesName} / ${d.label}`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <span
        className={`dxm-node-dot dxm-node-dot-${d.status}`}
        aria-hidden="true"
      />
      <span className="dxm-node-title">{d.label}</span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

/** シリーズ曼陀羅・ミニ曼陀羅用。目次として読めるだけの情報を載せる */
export function CardNode({ data }: NodeProps) {
  const d = data as MandalaNodeData;
  const status = STATUS_LABEL[d.status];
  return (
    <div className={nodeClass(d, "card")}>
      <Handle type="target" position={Position.Top} isConnectable={false} />
      {d.current && <span className="dxm-node-pin">いまここ</span>}
      {d.ghost && <span className="dxm-node-series">{d.seriesName}</span>}
      <span className="dxm-node-title">{d.label}</span>
      {d.catch && <span className="dxm-node-catch">{d.catch}</span>}
      <span className="dxm-node-meta">
        {d.lessonCount} レッスン・約 {d.totalMinutes} 分
        {status && (
          <span className={`dxm-badge dxm-badge-${d.status}`}>{status}</span>
        )}
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
      <span className="dxm-node-title">{d.label}</span>
      <span className="dxm-node-meta">
        {d.collapsed?.courseCount ?? 0} コース・{d.lessonCount} レッスン
      </span>
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}

export const mandalaNodeTypes = {
  compact: CompactNode,
  card: CardNode,
  collapsedSeries: CollapsedSeriesNode,
};
