import { describe, expect, it } from "vitest";
import {
  resolveMandalaCourseId,
  resolveMandalaFlowchartNid,
} from "@/lib/global-mandala-selection";

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
