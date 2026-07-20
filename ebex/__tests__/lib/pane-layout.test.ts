import { describe, expect, it } from "vitest";
import {
  clampPaneWidth,
  computePane2Width,
  fitPaneLayout,
  PANE2_MIN_WIDTH,
  PANE_RESIZE_HANDLE_WIDTH_PX,
  PANE_WIDTH_LIMITS,
  PANE_WIDTH_STEP,
  snapPaneWidth,
  snapPaneWidths,
} from "@/components/workspace/pane-layout";

const storedDefaults = { pane1: 300, pane3: 600 };

function handles() {
  return 2 * PANE_RESIZE_HANDLE_WIDTH_PX;
}

describe("clampPaneWidth", () => {
  it("clamps pane1 to min and max", () => {
    expect(clampPaneWidth("pane1", PANE_WIDTH_LIMITS.pane1.min - 1)).toBe(
      PANE_WIDTH_LIMITS.pane1.min,
    );
    expect(clampPaneWidth("pane1", PANE_WIDTH_LIMITS.pane1.max + 1)).toBe(
      PANE_WIDTH_LIMITS.pane1.max,
    );
  });

  it("clamps pane3 to min and max", () => {
    expect(clampPaneWidth("pane3", 0)).toBe(PANE_WIDTH_LIMITS.pane3.min);
    expect(clampPaneWidth("pane3", 9999)).toBe(PANE_WIDTH_LIMITS.pane3.max);
  });
});

describe("snapPaneWidth", () => {
  it("snaps to nearest 5px step within limits", () => {
    expect(snapPaneWidth("pane1", 302)).toBe(300);
    expect(snapPaneWidth("pane1", 303)).toBe(305);
    expect(PANE_WIDTH_STEP).toBe(5);
  });
});

describe("snapPaneWidths", () => {
  it("snaps pane1 and pane3 only", () => {
    expect(snapPaneWidths({ pane1: 302, pane2: 598, pane3: 401 })).toEqual({
      pane1: 300,
      pane2: 598,
      pane3: 400,
    });
  });
});

describe("computePane2Width", () => {
  it("returns remaining width after pane1, pane3, and handles", () => {
    const totalWidth = 1500;
    expect(computePane2Width(storedDefaults, totalWidth)).toBe(
      totalWidth - storedDefaults.pane1 - storedDefaults.pane3 - handles(),
    );
  });
});

describe("fitPaneLayout", () => {
  it("returns requested pane1/pane3 with derived pane2 when space is ample", () => {
    const totalWidth = 1500;
    const result = fitPaneLayout({
      requested: { pane1: 300, pane2: 0, pane3: 600 },
      totalWidth,
    });

    expect(result.pane1).toBe(300);
    expect(result.pane3).toBe(600);
    expect(result.pane2).toBe(computePane2Width(storedDefaults, totalWidth));
    expect(result.pane2).toBeGreaterThanOrEqual(PANE2_MIN_WIDTH);
  });

  it("shrinks pane3 first when pane2 would fall below minimum", () => {
    const totalWidth =
      storedDefaults.pane1 +
      PANE2_MIN_WIDTH +
      PANE_WIDTH_LIMITS.pane3.min +
      handles();

    const result = fitPaneLayout({
      requested: { pane1: 300, pane2: 0, pane3: 800 },
      totalWidth,
    });

    expect(result.pane3).toBe(PANE_WIDTH_LIMITS.pane3.min);
    expect(result.pane1).toBe(storedDefaults.pane1);
    expect(result.pane2).toBeGreaterThanOrEqual(PANE2_MIN_WIDTH);
  });

  it("when expanding pane3 shrinks pane1 if needed", () => {
    const totalWidth = 1350;
    const result = fitPaneLayout({
      requested: { pane1: 300, pane2: 0, pane3: 700 },
      totalWidth,
      expandPane: "pane3",
    });

    expect(result.pane3).toBe(700);
    expect(result.pane1).toBeLessThan(300);
    expect(result.pane2).toBeGreaterThanOrEqual(PANE2_MIN_WIDTH);
  });
});
