"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getMermaidWorkspaceConfig,
  mandalaCurrentCourseStyleLine,
  scaleMiniMandalaThumbnailSvg,
} from "@/lib/mermaid-workspace-theme";
import { renderMermaidDiagram } from "@/lib/mermaid-render";
import type { Series, Course } from "@/lib/schema";
import {
  buildMiniMandalaGraphInput,
  type MiniMandalaGraphInput,
} from "@/lib/course-flow";

const miniSafeId = (id: string) => `M_${id.replace(/[^a-zA-Z0-9]/g, "_")}`;

function addMiniNode(
  lines: string[],
  nodeMap: Record<string, string>,
  ref: { id: string; name: string },
) {
  const safeLabel = (s: string) => s.replace(/"/g, "'");
  const nid = miniSafeId(ref.id);
  nodeMap[nid] = ref.id;
  lines.push(`  ${nid}("${safeLabel(ref.name)}")`);
  lines.push(`  click ${nid} call miniGraphNav()`);
  return nid;
}

function buildMermaidDef(input: MiniMandalaGraphInput): {
  def: string;
  nodeMap: Record<string, string>;
} {
  const lines = [
    "flowchart LR",
    // Start / Goal は枠を持たない文字だけのノード
    "  classDef mandalaTerminal fill:none,stroke:none,font-weight:bold",
  ];
  const safeLabel = (s: string) => s.replace(/"/g, "'");
  const currentId = "CURRENT";
  const nodeMap: Record<string, string> = { [currentId]: input.current.id };
  lines.push(`  ${currentId}("${safeLabel(input.current.name)}")`);
  lines.push(mandalaCurrentCourseStyleLine(currentId, 2));
  lines.push(`  click ${currentId} call miniGraphNav()`);

  // 宣言があれば入口・到達点を添える（遷移先を持たないので click は付けない）
  if (input.isStart) {
    lines.push(`  TSTART["Start"]:::mandalaTerminal`);
    lines.push(`  TSTART --> ${currentId}`);
  }
  if (input.isGoal) {
    lines.push(`  TGOAL["Goal"]:::mandalaTerminal`);
    lines.push(`  ${currentId} --> TGOAL`);
  }

  if (input.intraPrev) {
    const nid = addMiniNode(lines, nodeMap, input.intraPrev);
    lines.push(`  ${nid} --> ${currentId}`);
  }
  input.crossPrereqs.forEach((ref) => {
    const nid = addMiniNode(lines, nodeMap, ref);
    lines.push(`  ${nid} --> ${currentId}`);
  });
  if (input.intraNext) {
    const nid = addMiniNode(lines, nodeMap, input.intraNext);
    lines.push(`  ${currentId} --> ${nid}`);
  }
  input.crossNexts.forEach((ref) => {
    const nid = addMiniNode(lines, nodeMap, ref);
    lines.push(`  ${currentId} --> ${nid}`);
  });

  return { def: lines.join("\n"), nodeMap };
}

type Props = {
  series: Series[];
  /** 選択中コース。未選択（undefined）なら領域ごと畳む */
  course: Course | undefined;
  onSelectCourse: (courseId: string) => void;
};

/** 統合ツリーペイン下部のミニ曼陀羅固定領域（サムネイル＋拡大モーダル） */
export function MiniMandalaSection({ series, course, onSelectCourse }: Props) {
  const miniGraphInput = useMemo(
    () => (course ? buildMiniMandalaGraphInput(series, course) : null),
    [series, course],
  );

  const [mermaidIsDark, setMermaidIsDark] = useState(false);
  useEffect(() => {
    const update = () =>
      setMermaidIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  // --- Mermaid: サムネイル用（常に先行レンダリング）---
  const [thumbnailSvg, setThumbnailSvg] = useState<string>("");
  const [thumbnailError, setThumbnailError] = useState(false);
  useEffect(() => {
    if (!course || !miniGraphInput) {
      setThumbnailSvg("");
      setThumbnailError(false);
      return;
    }
    const { def } = buildMermaidDef(miniGraphInput);
    let cancelled = false;
    setThumbnailError(false);
    void renderMermaidDiagram(
      def,
      getMermaidWorkspaceConfig(
        document.documentElement.classList.contains("dark"),
        { thumbnail: true },
      ),
      `mthumb-${course.id.replace(/[^a-zA-Z0-9]/g, "")}`,
    )
      .then(({ svg }) => {
        if (cancelled) return;
        setThumbnailSvg(scaleMiniMandalaThumbnailSvg(svg));
        setThumbnailError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setThumbnailSvg("");
        setThumbnailError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [course, miniGraphInput, mermaidIsDark]);

  // --- Mermaid: モーダル用（開いたときにレンダリング・GlobalHeader と同じパターン）---
  const [mermaidModalOpen, setMermaidModalOpen] = useState(false);
  const [modalSvg, setModalSvg] = useState<string>("");
  const modalSvgRef = useRef<HTMLDivElement>(null);
  const modalBndRef = useRef<((el: Element) => void) | null>(null);
  const suppressMermaidModalCloseRef = useRef(false);

  const handleMermaidModalOpenChange = useCallback(
    (
      open: boolean,
      eventDetails?: {
        cancel?: () => void;
      },
    ) => {
      if (!open && suppressMermaidModalCloseRef.current) {
        eventDetails?.cancel?.();
        return;
      }
      setMermaidModalOpen(open);
    },
    [],
  );

  // グローバルコールバック登録（ミニグラフ専用）
  const stableSelectCourse = useCallback(onSelectCourse, [onSelectCourse]);
  const navigateFromMiniMandala = useCallback(
    (nodeId: string) => {
      const w = window as unknown as Record<string, unknown>;
      const map = w["miniGraphNodeMap"] as Record<string, string> | undefined;
      const courseId =
        map?.[nodeId] ?? nodeId.replace(/^M_/, "").replace(/_/g, "-");
      suppressMermaidModalCloseRef.current = true;
      stableSelectCourse(courseId);
      window.setTimeout(() => {
        suppressMermaidModalCloseRef.current = false;
      }, 300);
    },
    [stableSelectCourse],
  );
  useEffect(() => {
    (window as unknown as Record<string, unknown>)["miniGraphNav"] =
      navigateFromMiniMandala;
    return () => {
      const w = window as unknown as Record<string, unknown>;
      delete w["miniGraphNav"];
      delete w["miniGraphNodeMap"];
    };
  }, [navigateFromMiniMandala]);

  const handleMiniMandalaGraphClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      for (const el of e.nativeEvent.composedPath()) {
        const svgG = el as Element;
        if (svgG.tagName === "g" && (svgG as SVGGElement).id) {
          const match = (svgG as SVGGElement).id.match(
            /-flowchart-(M_[^-]+|CURRENT)-/,
          );
          if (match) {
            navigateFromMiniMandala(match[1]);
            return;
          }
        }
      }
    },
    [navigateFromMiniMandala],
  );

  // モーダルが開いたときだけレンダリング（GlobalHeader と同じ lazy パターン）
  useEffect(() => {
    if (!mermaidModalOpen || !course || !miniGraphInput) return;
    const { def, nodeMap } = buildMermaidDef(miniGraphInput);
    (window as unknown as Record<string, unknown>)["miniGraphNodeMap"] = nodeMap;
    let cancelled = false;
    void renderMermaidDiagram(
      def,
      getMermaidWorkspaceConfig(mermaidIsDark),
      `mmodal-${course.id.replace(/[^a-zA-Z0-9]/g, "")}`,
    )
      .then(({ svg, bindFunctions }) => {
        if (cancelled) return;
        modalBndRef.current = bindFunctions ?? null;
        setModalSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setModalSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [mermaidModalOpen, course, miniGraphInput, mermaidIsDark]);

  // モーダルを閉じたら SVG リセット
  useEffect(() => {
    if (!mermaidModalOpen) setModalSvg("");
  }, [mermaidModalOpen]);

  // SVG が DOM に描画されたら bindFunctions を呼ぶ（GlobalHeader と同じ）
  useEffect(() => {
    if (modalSvg && modalSvgRef.current && modalBndRef.current) {
      modalBndRef.current(modalSvgRef.current);
    }
  }, [modalSvg]);

  const modal = (
    <Dialog open={mermaidModalOpen} onOpenChange={handleMermaidModalOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ミニ曼陀羅</DialogTitle>
        </DialogHeader>
        {modalSvg ? (
          <div className="flex justify-center overflow-auto rounded bg-card p-4">
            <div
              ref={modalSvgRef}
              className="mini-mandala-graph w-fit"
              dangerouslySetInnerHTML={{ __html: modalSvg }}
              onClick={handleMiniMandalaGraphClick}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
            グラフを生成中...
          </div>
        )}
        <p className="pt-1 text-left text-[11px] text-muted-foreground">
          ノードをクリックするとそのコースに移動します
        </p>
      </DialogContent>
    </Dialog>
  );

  // コース未選択時は領域ごと畳む（モーダルはナビゲーション途中に開いたままにできるよう常に描く）
  if (!course || !miniGraphInput) {
    return modal;
  }

  return (
    <>
      <div className="shrink-0 border-t border-border px-2 py-2 sidebar-label">
        {thumbnailSvg ? (
          <button
            type="button"
            className="block w-full min-w-0 cursor-zoom-in overflow-hidden rounded border border-border/50 bg-muted/30 p-1 text-left transition-colors hover:bg-muted/50"
            onClick={() => setMermaidModalOpen(true)}
            aria-label="ミニ曼陀羅を拡大表示"
          >
            <div
              className="mini-mandala-thumbnail w-full min-w-0"
              dangerouslySetInnerHTML={{ __html: thumbnailSvg }}
            />
          </button>
        ) : (
          <button
            type="button"
            className="flex min-h-[72px] w-full items-center justify-center rounded border border-border/50 bg-muted/30 px-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted/50"
            onClick={() => setMermaidModalOpen(true)}
            aria-label="ミニ曼陀羅を拡大表示"
          >
            {thumbnailError
              ? "グラフを表示できません（クリックで拡大）"
              : "グラフを生成中..."}
          </button>
        )}
      </div>
      {modal}
    </>
  );
}
