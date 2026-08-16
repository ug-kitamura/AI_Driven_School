import { describe, expect, it } from "vitest";
import {
  patchGlobalMandalaSelection,
  resolveMandalaCourseId,
  resolveMandalaFlowchartNid,
} from "@/lib/global-mandala-selection";
import type { Course, Series } from "@/lib/schema";

function course(id: string, name: string): Course {
  return {
    id,
    name,
    cross_series_prev: [],
    cross_series_next: [],
    lessons: [],
  };
}

function series(id: string, courses: Course[]): Series {
  return { id, name: id, courses };
}

describe("resolveMandalaFlowchartNid", () => {
  it("extracts C0 from mermaid v11 node id", () => {
    expect(resolveMandalaFlowchartNid("mandala-global-flowchart-C0-0")).toBe(
      "C0",
    );
    expect(resolveMandalaFlowchartNid("C0")).toBe("C0");
  });
});

describe("resolveMandalaCourseId", () => {
  it("maps flowchart node id to course id", () => {
    const nodeMap = { C0: "c1", C1: "c2" };
    expect(resolveMandalaCourseId(nodeMap, "mandala-global-flowchart-C1-3")).toBe(
      "c2",
    );
    expect(resolveMandalaCourseId(nodeMap, "C1")).toBe("c2");
  });
});

function mandalaNodeGroup(id: string, label: string): SVGGElement {
  const NS = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(NS, "g") as SVGGElement;
  g.id = id;
  g.appendChild(document.createElementNS(NS, "rect"));
  const fo = document.createElementNS(NS, "foreignObject");
  const span = document.createElement("span");
  span.textContent = label;
  fo.appendChild(span);
  g.appendChild(fo);
  return g;
}

describe("patchGlobalMandalaSelection", () => {
  it("keeps selected label bold and unselected at normal weight", () => {
    const container = document.createElement("div");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.appendChild(mandalaNodeGroup("mandala-global-flowchart-C0-0", "DX piyopiyo コース"));
    svg.appendChild(mandalaNodeGroup("mandala-global-flowchart-C1-1", "Other"));
    container.appendChild(svg);

    patchGlobalMandalaSelection(
      container,
      [series("s1", [course("c1", "DX piyopiyo コース"), course("c2", "Other")])],
      { C0: "c1", C1: "c2" },
      "c1",
    );

    const selected = container.querySelector(
      "#mandala-global-flowchart-C0-0 span",
    ) as HTMLElement;
    const unselected = container.querySelector(
      "#mandala-global-flowchart-C1-1 span",
    ) as HTMLElement;

    expect(selected.style.fontWeight).toBe("700");
    expect(unselected.style.fontWeight).toBe("400");
    expect(selected.textContent).toBe("DX piyopiyo コース");
  });
});
