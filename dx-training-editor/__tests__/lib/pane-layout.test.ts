import { describe, expect, it } from "vitest";
import {
  clampPaneWidth,
  computePane3Width,
  fitPaneLayout,
  PANE3_MIN_WIDTH,
  PANE4_COLLAPSED_WIDTH,
  PANE_RESIZE_HANDLE_WIDTH_PX,
  PANE_WIDTH_LIMITS,
  PANE_WIDTH_STEP,
  snapPaneWidth,
  snapPaneWidths,
} from "@/components/workspace/pane-layout";

const defaultWidths = { pane1: 300, pane2: 300, pane4: 300 };

function handles(pane4Open: boolean) {
  return (pane4Open ? 2 : 1) * PANE_RESIZE_HANDLE_WIDTH_PX;
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

describe("computePane3Width", () => {
  it("subtracts pane widths, collapsed pane4, and handles", () => {
    const totalWidth = 1600;
    const widths = { pane1: 300, pane2: 300, pane4: 300 };
    expect(
      computePane3Width(widths, { totalWidth, pane4Open: true }),
    ).toBe(
      totalWidth -
        widths.pane1 -
        widths.pane2 -
        widths.pane4 -
        handles(true),
    );
  });

  it("uses collapsed pane4 width when closed", () => {
    const totalWidth = 1600;
    const widths = { pane1: 300, pane2: 300, pane4: 300 };
    expect(
      computePane3Width(widths, { totalWidth, pane4Open: false }),
    ).toBe(
      totalWidth -
        widths.pane1 -
        widths.pane2 -
        PANE4_COLLAPSED_WIDTH -
        handles(false),
    );
  });
});

describe("fitPaneLayout", () => {
  it("returns requested widths when pane3 has room", () => {
    const totalWidth =
      defaultWidths.pane1 +
      defaultWidths.pane2 +
      defaultWidths.pane4 +
      PANE3_MIN_WIDTH +
      handles(true) +
      100;

    expect(
      fitPaneLayout({
        requested: defaultWidths,
        totalWidth,
        pane4Open: true,
      }),
    ).toEqual(defaultWidths);
  });

  it("shrinks pane4 first when pane3 is below min", () => {
    const totalWidth =
      defaultWidths.pane1 +
      defaultWidths.pane2 +
      PANE_WIDTH_LIMITS.pane4.min +
      PANE3_MIN_WIDTH +
      handles(true);

    const result = fitPaneLayout({
      requested: defaultWidths,
      totalWidth,
      pane4Open: true,
    });

    expect(result.pane4).toBe(PANE_WIDTH_LIMITS.pane4.min);
    expect(result.pane1).toBe(defaultWidths.pane1);
    expect(result.pane2).toBe(defaultWidths.pane2);
    expect(
      computePane3Width(result, { totalWidth, pane4Open: true }),
    ).toBeGreaterThanOrEqual(PANE3_MIN_WIDTH);
  });

  it("shrinks pane4 then pane1 then pane2", () => {
    const totalWidth =
      PANE_WIDTH_LIMITS.pane1.min +
      PANE_WIDTH_LIMITS.pane2.min +
      PANE_WIDTH_LIMITS.pane4.min +
      PANE3_MIN_WIDTH +
      handles(true);

    const result = fitPaneLayout({
      requested: { pane1: 480, pane2: 520, pane4: 480 },
      totalWidth,
      pane4Open: true,
    });

    expect(result).toEqual({
      pane1: PANE_WIDTH_LIMITS.pane1.min,
      pane2: PANE_WIDTH_LIMITS.pane2.min,
      pane4: PANE_WIDTH_LIMITS.pane4.min,
    });
    expect(
      computePane3Width(result, { totalWidth, pane4Open: true }),
    ).toBeGreaterThanOrEqual(PANE3_MIN_WIDTH);
  });

  it("skips pane4 shrink when pane4 is closed", () => {
    const totalWidth =
      PANE_WIDTH_LIMITS.pane1.min +
      PANE_WIDTH_LIMITS.pane2.min +
      PANE4_COLLAPSED_WIDTH +
      PANE3_MIN_WIDTH +
      handles(false);

    const result = fitPaneLayout({
      requested: { pane1: 480, pane2: 520, pane4: 480 },
      totalWidth,
      pane4Open: false,
    });

    expect(result.pane4).toBe(480);
    expect(result.pane1).toBe(PANE_WIDTH_LIMITS.pane1.min);
    expect(result.pane2).toBe(PANE_WIDTH_LIMITS.pane2.min);
  });

  it("returns all mins when viewport is below absolute minimum", () => {
    const totalWidth = 800;
    const result = fitPaneLayout({
      requested: { pane1: 480, pane2: 520, pane4: 480 },
      totalWidth,
      pane4Open: true,
    });

    expect(result.pane1).toBe(PANE_WIDTH_LIMITS.pane1.min);
    expect(result.pane2).toBe(PANE_WIDTH_LIMITS.pane2.min);
    expect(result.pane4).toBe(PANE_WIDTH_LIMITS.pane4.min);
    expect(
      computePane3Width(result, { totalWidth, pane4Open: true }),
    ).toBeLessThan(PANE3_MIN_WIDTH);
  });

  it("when expanding pane1 shrinks pane4 then pane2 but not pane1", () => {
    const totalWidth = 1600;
    const result = fitPaneLayout({
      requested: { pane1: 480, pane2: 300, pane4: 300 },
      totalWidth,
      pane4Open: true,
      expandPane: "pane1",
    });

    expect(result.pane1).toBe(480);
    expect(result.pane4).toBeLessThan(300);
    expect(
      computePane3Width(result, { totalWidth, pane4Open: true }),
    ).toBeGreaterThanOrEqual(PANE3_MIN_WIDTH);
  });

  it("when expanding pane2 shrinks only pane4", () => {
    const totalWidth = 1600;
    const result = fitPaneLayout({
      requested: { pane1: 300, pane2: 520, pane4: 300 },
      totalWidth,
      pane4Open: true,
      expandPane: "pane2",
    });

    expect(result.pane1).toBe(300);
    expect(result.pane2).toBe(520);
    expect(result.pane4).toBeLessThan(300);
    expect(
      computePane3Width(result, { totalWidth, pane4Open: true }),
    ).toBeGreaterThanOrEqual(PANE3_MIN_WIDTH);
  });

  it("when expanding pane4 shrinks pane1 then pane2 but not pane4", () => {
    const totalWidth = 1600;
    const result = fitPaneLayout({
      requested: { pane1: 300, pane2: 300, pane4: 480 },
      totalWidth,
      pane4Open: true,
      expandPane: "pane4",
    });

    expect(result.pane4).toBe(480);
    expect(result.pane1).toBeLessThan(300);
    expect(
      computePane3Width(result, { totalWidth, pane4Open: true }),
    ).toBeGreaterThanOrEqual(PANE3_MIN_WIDTH);
  });
});
