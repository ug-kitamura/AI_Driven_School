import type { Series } from "@/lib/schema";
import { MANDALA_CURRENT_COURSE_STROKE } from "@/lib/mermaid-workspace-theme";

const CURRENT_PREFIX = "★ ";
const CURRENT_STROKE_WIDTH = "2px";

export function resolveMandalaFlowchartNid(rawNodeId: string): string {
  const match = rawNodeId.match(/flowchart-(C\d+)-/);
  return match?.[1] ?? rawNodeId;
}

function findMandalaNodeGroup(container: Element, nid: string): SVGGElement | null {
  const match = container.querySelector(`g[id*="flowchart-${CSS.escape(nid)}-"]`);
  return match instanceof SVGGElement ? match : null;
}

function setNodeLabel(nodeEl: SVGGElement, label: string, bold: boolean): void {
  const fo = nodeEl.querySelector("foreignObject");
  const labelEl = fo?.querySelector("span, div, p");
  if (labelEl) {
    labelEl.textContent = label;
    if (labelEl instanceof HTMLElement) {
      labelEl.style.fontWeight = bold ? "700" : "";
    }
    return;
  }
  const text = nodeEl.querySelector("text");
  if (text) {
    text.textContent = label;
    text.style.fontWeight = bold ? "700" : "";
  }
}

function setNodeCurrentStyle(nodeEl: SVGGElement, isCurrent: boolean): void {
  const shape = nodeEl.querySelector("rect, path, polygon, circle, ellipse");
  if (!(shape instanceof SVGElement)) return;

  if (isCurrent) {
    shape.style.stroke = MANDALA_CURRENT_COURSE_STROKE;
    shape.style.strokeWidth = CURRENT_STROKE_WIDTH;
    shape.setAttribute("stroke", MANDALA_CURRENT_COURSE_STROKE);
    shape.setAttribute("stroke-width", CURRENT_STROKE_WIDTH);
  } else {
    shape.style.removeProperty("stroke");
    shape.style.removeProperty("stroke-width");
    shape.removeAttribute("stroke");
    shape.removeAttribute("stroke-width");
  }
}

/** グローバル曼陀羅 SVG 内の ★ 表示と現在コース枠線を更新する（Mermaid 再描画なし） */
export function patchGlobalMandalaSelection(
  container: HTMLElement,
  series: Series[],
  nodeMap: Record<string, string>,
  selectedCourseId: string,
): void {
  const nidByCourseId = new Map<string, string>();
  for (const [nid, courseId] of Object.entries(nodeMap)) {
    nidByCourseId.set(courseId, nid);
  }

  for (const s of series) {
    for (const c of s.courses) {
      const nid = nidByCourseId.get(c.id);
      if (!nid) continue;

      const nodeEl = findMandalaNodeGroup(container, nid);
      if (!nodeEl) continue;

      const isCurrent = c.id === selectedCourseId;
      setNodeLabel(
        nodeEl,
        isCurrent ? `${CURRENT_PREFIX}${c.name}` : c.name,
        isCurrent,
      );
      setNodeCurrentStyle(nodeEl, isCurrent);
    }
  }
}

export function resolveMandalaCourseId(
  nodeMap: Record<string, string>,
  rawNodeId: string,
): string | undefined {
  const nid = resolveMandalaFlowchartNid(rawNodeId);
  return nodeMap[nid];
}
