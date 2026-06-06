import { describe, expect, it } from "vitest";
import {
  clampPaneWidth,
  PANE_WIDTH_LIMITS,
  PANE_WIDTH_STEP,
  snapPaneWidth,
  snapPaneWidths,
} from "@/components/workspace/pane-layout";

describe("clampPaneWidth", () => {
  it("clamps pane1 to min and max", () => {
    expect(clampPaneWidth("pane1", PANE_WIDTH_LIMITS.pane1.min - 1)).toBe(
      PANE_WIDTH_LIMITS.pane1.min,
    );
    expect(clampPaneWidth("pane1", PANE_WIDTH_LIMITS.pane1.max + 1)).toBe(
      PANE_WIDTH_LIMITS.pane1.max,
    );
  });

  it("clamps pane2 to min and max", () => {
    expect(clampPaneWidth("pane2", PANE_WIDTH_LIMITS.pane2.min - 50)).toBe(
      PANE_WIDTH_LIMITS.pane2.min,
    );
    expect(clampPaneWidth("pane2", PANE_WIDTH_LIMITS.pane2.max + 50)).toBe(
      PANE_WIDTH_LIMITS.pane2.max,
    );
  });

  it("clamps pane4 to min and max", () => {
    expect(clampPaneWidth("pane4", 0)).toBe(PANE_WIDTH_LIMITS.pane4.min);
    expect(clampPaneWidth("pane4", 9999)).toBe(PANE_WIDTH_LIMITS.pane4.max);
  });

  it("returns value unchanged when within range", () => {
    expect(clampPaneWidth("pane1", 300)).toBe(300);
    expect(clampPaneWidth("pane4", 360)).toBe(360);
  });
});

describe("snapPaneWidth", () => {
  it("snaps to nearest 5px step within limits", () => {
    expect(snapPaneWidth("pane1", 302)).toBe(300);
    expect(snapPaneWidth("pane1", 303)).toBe(305);
    expect(PANE_WIDTH_STEP).toBe(5);
  });

  it("clamps before snapping at boundaries", () => {
    expect(snapPaneWidth("pane1", PANE_WIDTH_LIMITS.pane1.min - 3)).toBe(
      PANE_WIDTH_LIMITS.pane1.min,
    );
    expect(snapPaneWidth("pane4", PANE_WIDTH_LIMITS.pane4.max + 2)).toBe(
      PANE_WIDTH_LIMITS.pane4.max,
    );
  });
});

describe("snapPaneWidths", () => {
  it("snaps each pane independently", () => {
    expect(
      snapPaneWidths({ pane1: 302, pane2: 298, pane4: 301 }),
    ).toEqual({ pane1: 300, pane2: 300, pane4: 300 });
  });
});
