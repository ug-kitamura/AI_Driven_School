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
import type { Series } from "@/lib/schema";

// シリーズごとに割り当てるカラー（Mermaid classDef 用）
const SERIES_COLORS = [
  { fill: "#D1E4FF", stroke: "#007BC0", color: "#004F82" },
  { fill: "#D4EDDA", stroke: "#28A745", color: "#155724" },
  { fill: "#FFF3CD", stroke: "#FFC107", color: "#856404" },
  { fill: "#F8D7DA", stroke: "#DC3545", color: "#721C24" },
  { fill: "#E2D9F3", stroke: "#6F42C1", color: "#432874" },
];

// セーフな Mermaid ノード ID
const safeId = (id: string) => `N_${id.replace(/[^a-zA-Z0-9]/g, "_")}`;
const safeLabel = (s: string) => s.replace(/"/g, "'");

function buildFullMandalaGraph(
  series: Series[],
  selectedCourseId: string,
): { def: string; nodeMap: Record<string, string> } {
  const lines = ["flowchart TD"];
  const nodeMap: Record<string, string> = {};

  // classDef
  series.forEach((_, i) => {
    const c = SERIES_COLORS[i % SERIES_COLORS.length];
    lines.push(`  classDef s${i} fill:${c.fill},stroke:${c.stroke}`);
  });
  lines.push(`  classDef cur fill:#007BC0,stroke:#004F82`);

  // シリーズごとにサブグラフとノード
  series.forEach((s, si) => {
    const sgId = `SG${safeId(s.id)}`;
    lines.push(`  subgraph ${sgId}["${safeLabel(s.name)}"]`);
    s.courses.forEach((c) => {
      const nid = safeId(c.id);
      nodeMap[nid] = c.id;                          // nodeId → courseId マッピング
      const cls = c.id === selectedCourseId ? "cur" : `s${si}`;
      lines.push(`    ${nid}["${safeLabel(c.name)}"]:::${cls}`);
    });
    lines.push("  end");
  });

  // 依存エッジ
  series.forEach((s) => {
    s.courses.forEach((c) => {
      c.next_courses.forEach((nextId) => {
        lines.push(`  ${safeId(c.id)} --> ${safeId(nextId)}`);
      });
    });
  });

  // click ディレクティブ（Mermaid v11 は括弧必須）
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
      console.log("[mandalaNav] called with nodeId:", nodeId);
      const w = window as unknown as Record<string, unknown>;
      const map = w["mandalaNodeMap"] as Record<string, string> | undefined;
      console.log("[mandalaNav] nodeMap:", map);
      const courseId = map?.[nodeId] ?? nodeId.replace(/^N_/, "").replace(/_/g, "-");
      console.log("[mandalaNav] resolved courseId:", courseId);
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
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
        const { svg, bindFunctions } = await mermaid.render(`mandala-${Date.now()}`, def);
        if (!cancelled) {
          bindFnsRef.current = bindFunctions ?? null;
          setMandalaSvg(svg);
          setMandalaDebug("");
        }
      } catch (err) {
        console.error("[Mandala] render error:", err);
        if (!cancelled) setMandalaDebug(`ERROR: ${String(err)}\n\n---\n${def}`);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mandalaOpen, series, selectedCourseId]);

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
      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-primary"
        onClick={() => setMandalaOpen(true)}
        title="DXトレーニング曼陀羅"
      >
        <Network className="h-4 w-4" />
        <span className="hidden sm:inline">曼陀羅</span>
      </Button>

      {/* 曼陀羅フルスクリーンモーダル */}
      <Dialog open={mandalaOpen} onOpenChange={setMandalaOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>DXトレーニング曼陀羅</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded bg-white p-4 min-h-0">
            {mandalaSvg ? (
              <div
                ref={svgContainerRef}
                className="flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: mandalaSvg }}
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
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            ★ = 現在選択中のコース　　ノードをクリックするとそのコースに移動します
          </p>
        </DialogContent>
      </Dialog>
    </header>
  );
}
