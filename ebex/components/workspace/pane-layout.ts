export type WorkspacePaneWidths = {
  pane1: number;
  pane2: number;
  pane3: number;
};

export const PANE_WIDTH_DEFAULTS: WorkspacePaneWidths = {
  pane1: 250,
  pane2: 600,
  pane3: 400,
};

/** 各ペインの最小幅 */
export const PANE_MIN_WIDTHS: Record<keyof WorkspacePaneWidths, number> = {
  pane1: 200,
  pane2: 400,
  pane3: 300,
};

/** ウィンドウリサイズ等: 不足時の縮小順 */
export const PANE_SHRINK_ORDER_DEFAULT: (keyof WorkspacePaneWidths)[] = [
  "pane3",
  "pane1",
  "pane2",
];

/** 各ペインを広げる際に他ペインを縮める順 */
export const PANE_SHRINK_ORDER_WHEN_EXPAND: Record<
  keyof WorkspacePaneWidths,
  (keyof WorkspacePaneWidths)[]
> = {
  pane1: ["pane3", "pane2"],
  pane2: ["pane3", "pane1"],
  pane3: ["pane1", "pane2"],
};

/** メインペイン行のリサイズハンドル 1 本あたりのレイアウト幅（px） */
export const PANE_RESIZE_HANDLE_WIDTH_PX = 8;

/** 設定モーダルでのペイン既定幅の変更刻み（px） */
export const PANE_WIDTH_STEP = 5;

export const PANE_WIDTH_LIMITS = {
  pane1: { min: 200, max: 400 },
  pane2: { min: 400, max: 1200 },
  pane3: { min: 300, max: 800 },
} as const;

/** 左端の区切り線: 右ドラッグでペイン幅が狭くなる */
export const PANE_RESIZE_INVERT_DELTA: Record<
  keyof WorkspacePaneWidths,
  boolean
> = {
  pane1: false,
  pane2: false,
  pane3: true,
};

export type FitActivePane = keyof WorkspacePaneWidths | null;

export type FitPaneLayoutInput = {
  requested: WorkspacePaneWidths;
  totalWidth: number;
  expandPane?: FitActivePane;
};

import { STORAGE_KEYS } from "@/lib/storage-keys";

const STORAGE_KEY = STORAGE_KEYS.paneWidths;
const SETTINGS_STORAGE_KEY = STORAGE_KEYS.settings;

function loadPaneDefaultsFromSettings(): WorkspacePaneWidths {
  if (typeof window === "undefined") return { ...PANE_WIDTH_DEFAULTS };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...PANE_WIDTH_DEFAULTS };
    const parsed = JSON.parse(raw) as {
      paneDefaults?: Partial<WorkspacePaneWidths>;
    };
    const d = parsed.paneDefaults;
    return {
      pane1: clampPaneWidth("pane1", d?.pane1 ?? PANE_WIDTH_DEFAULTS.pane1),
      pane2: clampPaneWidth("pane2", d?.pane2 ?? PANE_WIDTH_DEFAULTS.pane2),
      pane3: clampPaneWidth("pane3", d?.pane3 ?? PANE_WIDTH_DEFAULTS.pane3),
    };
  } catch {
    return { ...PANE_WIDTH_DEFAULTS };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampRequestedWidths(
  requested: WorkspacePaneWidths,
): WorkspacePaneWidths {
  return {
    pane1: clampPaneWidth("pane1", requested.pane1),
    pane2: clampPaneWidth("pane2", requested.pane2),
    pane3: clampPaneWidth("pane3", requested.pane3),
  };
}

function mainRowHandleCount(): number {
  return 2;
}

function totalPaneWidth(widths: WorkspacePaneWidths): number {
  return widths.pane1 + widths.pane2 + widths.pane3;
}

function shrinkOrderFor(input: FitPaneLayoutInput): (keyof WorkspacePaneWidths)[] {
  if (input.expandPane) {
    return PANE_SHRINK_ORDER_WHEN_EXPAND[input.expandPane];
  }
  return PANE_SHRINK_ORDER_DEFAULT;
}

/** 利用可能幅に収める */
export function fitPaneLayout(input: FitPaneLayoutInput): WorkspacePaneWidths {
  let widths = clampRequestedWidths(input.requested);
  const expandPane = input.expandPane ?? null;
  const shrinkOrder = shrinkOrderFor(input);
  const handles = mainRowHandleCount() * PANE_RESIZE_HANDLE_WIDTH_PX;
  const available = input.totalWidth - handles;

  for (;;) {
    const used = totalPaneWidth(widths);
    if (used <= available) {
      return widths;
    }

    const deficit = used - available;
    let remaining = deficit;

    for (const pane of shrinkOrder) {
      if (remaining <= 0) break;
      if (pane === expandPane) continue;

      const { min } = PANE_WIDTH_LIMITS[pane];
      const canShrink = widths[pane] - min;
      if (canShrink <= 0) continue;

      const take = Math.min(canShrink, remaining);
      widths = { ...widths, [pane]: widths[pane] - take };
      remaining -= take;
    }

    if (remaining > 0) {
      if (expandPane) {
        widths = {
          ...widths,
          [expandPane]: clampPaneWidth(
            expandPane,
            widths[expandPane] - remaining,
          ),
        };
      }
      return widths;
    }
  }
}

export function clampPaneWidth(
  pane: keyof WorkspacePaneWidths,
  value: number,
): number {
  const { min, max } = PANE_WIDTH_LIMITS[pane];
  return clamp(value, min, max);
}

export function snapPaneWidth(
  pane: keyof WorkspacePaneWidths,
  value: number,
): number {
  const clamped = clampPaneWidth(pane, value);
  return clampPaneWidth(
    pane,
    Math.round(clamped / PANE_WIDTH_STEP) * PANE_WIDTH_STEP,
  );
}

export function snapPaneWidths(widths: WorkspacePaneWidths): WorkspacePaneWidths {
  return {
    pane1: snapPaneWidth("pane1", widths.pane1),
    pane2: snapPaneWidth("pane2", widths.pane2),
    pane3: snapPaneWidth("pane3", widths.pane3),
  };
}

export function loadPaneWidths(): WorkspacePaneWidths {
  if (typeof window === "undefined") return { ...PANE_WIDTH_DEFAULTS };
  const defaults = loadPaneDefaultsFromSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<WorkspacePaneWidths>;
    return {
      pane1: clampPaneWidth("pane1", parsed.pane1 ?? defaults.pane1),
      pane2: clampPaneWidth("pane2", parsed.pane2 ?? defaults.pane2),
      pane3: clampPaneWidth("pane3", parsed.pane3 ?? defaults.pane3),
    };
  } catch {
    return { ...defaults };
  }
}

export function savePaneWidths(widths: WorkspacePaneWidths) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // ignore quota errors
  }
}
