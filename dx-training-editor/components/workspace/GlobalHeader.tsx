"use client";

import { useState, useEffect, useRef } from "react";
import { Network } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Series } from "@/lib/schema";
import { isCrossSeriesLink } from "@/lib/course-flow";

// セーフな Mermaid ノード ID
const safeId = (id: string) => `N_${id.replace(/[^a-zA-Z0-9]/g, "_")}`;
const safeLabel = (s: string) => s.replace(/"/g, "'");

function buildFullMandalaGraph(
  series: Series[],
  selectedCourseId: string,
): { def: string; nodeMap: Record<string, string> } {
  const lines = ["flowchart TD"];
  const nodeMap: Record<string, string> = {};

  // シリーズごとにサブグラフとノード（丸みノード、方向は TB に統一）
  const currentNid: string[] = [];
  series.forEach((s) => {
    const sgId = `SG${safeId(s.id)}`;
    lines.push(`  subgraph ${sgId}["${safeLabel(s.name)}"]`);
    lines.push(`    direction TB`);
    s.courses.forEach((c) => {
      const nid = safeId(c.id);
      nodeMap[nid] = c.id;
      const isCurrent = c.id === selectedCourseId;
      const label = isCurrent ? `★ ${safeLabel(c.name)}` : safeLabel(c.name);
      lines.push(`    ${nid}("${label}")`);
      if (isCurrent) currentNid.push(nid);
    });
    lines.push("  end");
  });

  // 現在選択中コースに style を適用（classDef より安定）
  currentNid.forEach((nid) => {
    lines.push(`  style ${nid} stroke-width:3px,font-weight:bold`);
  });

  // シリーズ内: 配列順の隣接鎖
  series.forEach((s) => {
    for (let i = 1; i < s.courses.length; i++) {
      const prev = s.courses[i - 1];
      const curr = s.courses[i];
      lines.push(`  ${safeId(prev.id)} --> ${safeId(curr.id)}`);
    }
  });

  // 別シリーズ: prerequisites と next_courses（同一 from→to は1本にまとめる）
  const crossEdgeKeys = new Set<string>();
  const addCrossEdge = (fromId: string, toId: string) => {
    const key = `${fromId}-->${toId}`;
    if (crossEdgeKeys.has(key)) return;
    crossEdgeKeys.add(key);
    lines.push(`  ${safeId(fromId)} --> ${safeId(toId)}`);
  };
  series.forEach((s) => {
    s.courses.forEach((c) => {
      c.prerequisites.forEach((prevId) => {
        if (isCrossSeriesLink(series, c.id, prevId)) {
          addCrossEdge(prevId, c.id);
        }
      });
      c.next_courses.forEach((nextId) => {
        if (isCrossSeriesLink(series, c.id, nextId)) {
          addCrossEdge(c.id, nextId);
        }
      });
    });
  });

  // click ディレクティブ
  series.forEach((s) => {
    s.courses.forEach((c) => {
      lines.push(`  click ${safeId(c.id)} call mandalaNav()`);
    });
  });

  return { def: lines.join("\n"), nodeMap };
}

type GlobalHeaderProps = {
  departmentTitle: string;
  positionTitle: string;
  candidateName: string;
  series?: Series[];
  selectedCourseId?: string;
  onSelectCourse?: (courseId: string) => void;
  // 後方互換のため残す（未使用）
  departments?: unknown[];
  onAddDepartment?: (name: string) => void;
  onDeleteDepartment?: (deptId: string) => void;
};

export function GlobalHeader({
  departmentTitle,
  positionTitle,
  candidateName,
  series = [],
  selectedCourseId = "",
  onSelectCourse,
}: GlobalHeaderProps) {
  const [mandalaOpen, setMandalaOpen] = useState(false);
  const [mandalaSvg, setMandalaSvg] = useState("");
  const [mandalaDebug, setMandalaDebug] = useState("");
  const svgContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bindFnsRef = useRef<((el: Element) => void) | null>(null);

  // グローバルコールバック登録（曼陀羅モーダル専用）
  // Mermaid の click call は nodeId を第1引数として渡す → nodeId から courseId をルックアップ
  useEffect(() => {
    (window as unknown as Record<string, unknown>)["mandalaNav"] = (nodeId: string) => {
      const w = window as unknown as Record<string, unknown>;
      const map = w["mandalaNodeMap"] as Record<string, string> | undefined;
      const courseId = map?.[nodeId] ?? nodeId.replace(/^N_/, "").replace(/_/g, "-");
      onSelectCourse?.(courseId);
      setMandalaOpen(false);
    };
    return () => {
      const w = window as unknown as Record<string, unknown>;
      delete w["mandalaNav"];
      delete w["mandalaNodeMap"];
    };
  }, [onSelectCourse]);

  // モーダルを開いたときに Mermaid レンダリング
  useEffect(() => {
    if (!mandalaOpen || series.length === 0) return;
    const { def, nodeMap } = buildFullMandalaGraph(series, selectedCourseId);
    // nodeId → courseId マップを window に登録
    (window as unknown as Record<string, unknown>)["mandalaNodeMap"] = nodeMap;
    setMandalaDebug(def);
    let cancelled = false;
    import("mermaid").then(async (m) => {
      if (cancelled) return;
      try {
        const mermaid = m.default;
        mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "loose" });
        const { svg, bindFunctions } = await mermaid.render(`mandala-${Date.now()}`, def);
        if (!cancelled) {
          bindFnsRef.current = bindFunctions ?? null;
          setMandalaSvg(svg);
          setMandalaDebug("");
        }
      } catch (err) {
        if (!cancelled) setMandalaDebug(`ERROR: ${String(err)}\n\n---\n${def}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mandalaOpen, series, selectedCourseId]);

  // モーダルを閉じたら SVG をリセット（次回オープン時に古いキャッシュを表示しない）
  useEffect(() => {
    if (!mandalaOpen) {
      setMandalaSvg("");
      setMandalaDebug("");
    }
  }, [mandalaOpen]);

  // SVG が DOM に描画されたタイミングで bindFunctions を呼びクリックハンドラを紐付ける
  useEffect(() => {
    if (mandalaSvg && svgContainerRef.current && bindFnsRef.current) {
      bindFnsRef.current(svgContainerRef.current);
    }
  }, [mandalaSvg]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <Breadcrumb
        className="min-w-0 flex-1 overflow-hidden"
        aria-label="パンくず"
      >
        <BreadcrumbList className="flex-nowrap text-[11px]">
          {departmentTitle && (
            <>
              <BreadcrumbItem className="shrink-0">
                <BreadcrumbLink>{departmentTitle}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          {positionTitle && (
            <>
              <BreadcrumbItem className="shrink-0">
                <BreadcrumbLink>{positionTitle}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-medium">
              {candidateName}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* 曼陀羅ボタン */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-primary"
              onClick={() => setMandalaOpen(true)}
            >
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">DXトレーニング曼陀羅</span>
            </Button>
          }
        />
        <TooltipContent side="bottom">DXトレーニング曼陀羅</TooltipContent>
      </Tooltip>

      {/* 曼陀羅フルスクリーンモーダル */}
      <Dialog open={mandalaOpen} onOpenChange={setMandalaOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>DXトレーニング曼陀羅</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded bg-white p-4 min-h-0">
            {mandalaSvg ? (
              <div
                ref={svgContainerRef}
                className="flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: mandalaSvg }}
                onClick={(e) => {
                  const t = e.target as Element;
                  const g = t.closest("g") as SVGGElement | null;
                  if (!g) return;
                  const match = g.id.match(/-flowchart-(N_[^-]+)-/);
                  if (!match) return;
                  const nodeId = match[1];
                  const nav = (window as unknown as Record<string, unknown>)["mandalaNav"] as ((id: string) => void) | undefined;
                  nav?.(nodeId);
                }}
              />
            ) : mandalaDebug ? (
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                {mandalaDebug}
              </pre>
            ) : (
              <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                グラフを生成中...
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground text-left pt-1">
            ★ = 現在選択中のコース　　ノードをクリックするとそのコースに移動します
          </p>
        </DialogContent>
      </Dialog>
    </header>
  );
}
