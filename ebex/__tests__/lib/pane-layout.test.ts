import { describe, expect, it } from "vitest";
import {
  clampPaneWidth,
  fitPaneLayout,
  PANE_RESIZE_HANDLE_WIDTH_PX,
  PANE_WIDTH_LIMITS,
  PANE_WIDTH_STEP,
  snapPaneWidth,
  snapPaneWidths,
} from "@/components/workspace/pane-layout";

const defaultWidths = { pane1: 250, pane2: 600, pane3: 400 };

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
  it("snaps each pane independently", () => {
    expect(
      snapPaneWidths({ pane1: 302, pane2: 598, pane3: 301 }),
    ).toEqual({ pane1: 300, pane2: 600, pane3: 300 });
  });
});

describe("fitPaneLayout", () => {
  it("returns requested widths when all panes fit", () => {
    const totalWidth =
      defaultWidths.pane1 +
      defaultWidths.pane2 +
      defaultWidths.pane3 +
      handles() +
      100;

    expect(
      fitPaneLayout({
        requested: defaultWidths,
        totalWidth,
      }),
    ).toEqual(defaultWidths);
  });

  it("shrinks pane3 first when space is tight", () => {
    const totalWidth =
      defaultWidths.pane1 +
      defaultWidths.pane2 +
      PANE_WIDTH_LIMITS.pane3.min +
      handles();

    const result = fitPaneLayout({
      requested: defaultWidths,
      totalWidth,
    });

    expect(result.pane3).toBe(PANE_WIDTH_LIMITS.pane3.min);
    expect(result.pane1).toBe(defaultWidths.pane1);
    expect(result.pane2).toBe(defaultWidths.pane2);
  });

  it("when expanding pane2 shrinks pane3 first", () => {
    const totalWidth = 1510;
    const result = fitPaneLayout({
      requested: { pane1: 250, pane2: 700, pane3: 450 },
      totalWidth,
      expandPane: "pane2",
    });

    expect(result.pane2).toBe(700);
    expect(result.pane3).toBeLessThanOrEqual(450);
  });
});
