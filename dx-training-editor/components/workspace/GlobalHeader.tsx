"use client";

import { useState, useEffect, useRef } from "react";
import { Network, Settings } from "lucide-react";
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
import { findSeriesContainingCourse, isCrossSeriesLink } from "@/lib/course-flow";
import {
  getMermaidWorkspaceConfig,
  mandalaCurrentCourseStyleLine,
} from "@/lib/mermaid-workspace-theme";

const safeLabel = (s: string) => s.replace(/"/g, "'");

function buildFullMandalaGraph(
  series: Series[],
  selectedCourseId: string,
): { def: string; nodeMap: Record<string, string> } {
  const lines = ["flowchart TD", "  classDef mandalaSeriesTitle font-weight:bold"];
  const nodeMap: Record<string, string> = {};

  // Mermaid ノード ID は英数字のみ有効。日本語 ID を直接使えないため
  // 全コース・シリーズを連番で割り当て、nodeMap で逆引きする
  let idCounter = 0;
  const courseIdToNid = new Map<string, string>(
    series.flatMap((s) => s.courses.map((c) => [c.id, `C${idCounter++}`] as [string, string])),
  );
  const seriesIdToSgId = new Map<string, string>(
    series.map((s) => [s.id, `SG${idCounter++}`] as [string, string]),
  );
  const toNid = (id: string) => courseIdToNid.get(id) ?? `C${id}`;
  const toSgId = (id: string) => seriesIdToSgId.get(id) ?? `SG${id}`;

  // シリーズごとにサブグラフとノード（丸みノード、方向は TB に統一）
  const currentNid: string[] = [];
  series.forEach((s) => {
    const sgId = toSgId(s.id);
    lines.push(`  subgraph ${sgId}["${safeLabel(s.name)}"]`);
    lines.push(`    direction TB`);
    s.courses.forEach((c) => {
      const nid = toNid(c.id);
      nodeMap[nid] = c.id;
      const isCurrent = c.id === selectedCourseId;
      const label = isCurrent ? `★ ${safeLabel(c.name)}` : safeLabel(c.name);
      lines.push(`    ${nid}("${label}")`);
      if (isCurrent) currentNid.push(nid);
    });
    lines.push("  end");
    lines.push(`  class ${sgId} mandalaSeriesTitle`);
  });

  // 現在選択中コースに style を適用（classDef より安定）
  currentNid.forEach((nid) => {
    lines.push(mandalaCurrentCourseStyleLine(nid, 2));
  });

  // シリーズ内: 配列順の隣接鎖
  series.forEach((s) => {
    for (let i = 1; i < s.courses.length; i++) {
      const prev = s.courses[i - 1];
      const curr = s.courses[i];
      lines.push(`  ${toNid(prev.id)} --> ${toNid(curr.id)}`);
    }
  });

  // 別シリーズ: prerequisites と next_courses（同一 from→to は1本にまとめる）
  const crossEdgeKeys = new Set<string>();
  const addCrossEdge = (fromId: string, toId: string) => {
    const key = `${fromId}-->${toId}`;
    if (crossEdgeKeys.has(key)) return;
    crossEdgeKeys.add(key);
    lines.push(`  ${toNid(fromId)} --> ${toNid(toId)}`);
  };
  series.forEach((s) => {
    s.courses.forEach((c) => {
      c.prerequisites.forEach((prevId) => {
        if (
          findSeriesContainingCourse(series, prevId) &&
          isCrossSeriesLink(series, c.id, prevId)
        ) {
          addCrossEdge(prevId, c.id);
        }
      });
      c.next_courses.forEach((nextId) => {
        if (
          findSeriesContainingCourse(series, nextId) &&
          isCrossSeriesLink(series, c.id, nextId)
        ) {
          addCrossEdge(c.id, nextId);
        }
      });
    });
  });

  // click ディレクティブ
  series.forEach((s) => {
    s.courses.forEach((c) => {
      lines.push(`  click ${toNid(c.id)} call mandalaNav()`);
    });
  });

  return { def: lines.join("\n"), nodeMap };
}

type GlobalHeaderProps = {
  seriesName: string;
  courseName: string;
  lessonName: string;
  series?: Series[];
  selectedCourseId?: string;
  onSelectCourse?: (courseId: string) => void;
  onOpenSettings?: () => void;
};

export function GlobalHeader({
  seriesName,
  courseName,
  lessonName,
  series = [],
  selectedCourseId = "",
  onSelectCourse,
  onOpenSettings,
}: GlobalHeaderProps) {
  const [mandalaOpen, setMandalaOpen] = useState(false);
  const [mandalaSvg, setMandalaSvg] = useState("");
  const [mandalaDebug, setMandalaDebug] = useState("");
  const [isDark, setIsDark] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
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
        mermaid.initialize(getMermaidWorkspaceConfig(isDark, { global: true }));
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
  }, [mandalaOpen, series, selectedCourseId, isDark]);

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
          {seriesName && (
            <>
              <BreadcrumbItem className="shrink-0">
                <BreadcrumbLink>{seriesName}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          {courseName && (
            <>
              <BreadcrumbItem className="shrink-0">
                <BreadcrumbLink>{courseName}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-medium">
              {lessonName}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-primary"
        onClick={() => setMandalaOpen(true)}
      >
        <Network className="h-4 w-4" />
        <span className="hidden sm:inline">DXトレーニング曼陀羅</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-primary"
        onClick={() => onOpenSettings?.()}
        aria-label="設定"
      >
        <Settings className="size-4" />
      </Button>

      {/* 曼陀羅フルスクリーンモーダル */}
      <Dialog open={mandalaOpen} onOpenChange={setMandalaOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>DXトレーニング曼陀羅</DialogTitle>
          </DialogHeader>
          <div className="workspace-scrollbar flex flex-1 justify-center overflow-auto rounded bg-card p-3 min-h-0">
            {mandalaSvg ? (
              <div
                ref={svgContainerRef}
                className="global-mandala-graph w-fit"
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
