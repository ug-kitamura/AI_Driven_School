export type WorkspacePaneWidths = {
  pane1: number;
  pane2: number;
  pane4: number;
};

export const PANE_WIDTH_DEFAULTS: WorkspacePaneWidths = {
  pane1: 270,
  pane2: 300,
  pane4: 285,
};

/** Pane3（エディタ）の最小幅 — 派生幅のため設定 UI には含めない */
export const PANE3_MIN_WIDTH = 520;

/** Pane4 折りたたみ時ストリップ幅（w-12） */
export const PANE4_COLLAPSED_WIDTH = 48;

/** ウィンドウリサイズ等: pane3 不足時の縮小順 */
export const PANE_SHRINK_ORDER_DEFAULT: (keyof WorkspacePaneWidths)[] = [
  "pane4",
  "pane1",
  "pane2",
];

/** 各ペインを広げる際に他ペインを縮める順（pane3 は常に最後＝ここには含めない） */
export const PANE_SHRINK_ORDER_WHEN_EXPAND: Record<
  keyof WorkspacePaneWidths,
  (keyof WorkspacePaneWidths)[]
> = {
  pane1: ["pane4", "pane2"],
  pane2: ["pane4"],
  pane4: ["pane1", "pane2"],
};

/** ImageGrid セル最小幅（px） */
export const IMAGE_GRID_CELL_MIN = 100;

/** メインペイン行のリサイズハンドル 1 本あたりのレイアウト幅（px） */
export const PANE_RESIZE_HANDLE_WIDTH_PX = 8;

/** 設定モーダルでのペイン既定幅の変更刻み（px） */
export const PANE_WIDTH_STEP = 5;

export const PANE_WIDTH_LIMITS = {
  pane1: { min: 180, max: 480 },
  pane2: { min: 200, max: 520 },
  pane4: { min: 240, max: 480 },
} as const;

/** 左端の区切り線: 右ドラッグでペイン幅が狭くなる */
export const PANE_RESIZE_INVERT_DELTA: Record<
  keyof WorkspacePaneWidths,
  boolean
> = {
  pane1: false,
  pane2: false,
  pane4: true,
};

export type FitActivePane = keyof WorkspacePaneWidths | null;

export type FitPaneLayoutInput = {
  requested: WorkspacePaneWidths;
  /** ワークスペース全体幅（SidebarProvider 等） */
  totalWidth: number;
  pane4Open: boolean;
  /** ドラッグで拡大中のペイン。null はウィンドウリサイズ・設定適用 */
  expandPane?: FitActivePane;
};

function shrinkOrderFor(input: FitPaneLayoutInput): (keyof WorkspacePaneWidths)[] {
  if (input.expandPane) {
    return PANE_SHRINK_ORDER_WHEN_EXPAND[input.expandPane];
  }
  return PANE_SHRINK_ORDER_DEFAULT;
}

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
      pane4: clampPaneWidth("pane4", d?.pane4 ?? PANE_WIDTH_DEFAULTS.pane4),
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
    pane4: clampPaneWidth("pane4", requested.pane4),
  };
}

function mainRowHandleCount(pane4Open: boolean): number {
  return pane4Open ? 2 : 1;
}

function pane4EffectiveWidth(
  widths: WorkspacePaneWidths,
  pane4Open: boolean,
): number {
  return pane4Open ? widths.pane4 : PANE4_COLLAPSED_WIDTH;
}

/** pane3 実幅（px）を算出する */
export function computePane3Width(
  widths: WorkspacePaneWidths,
  options: { totalWidth: number; pane4Open: boolean },
): number {
  const handles =
    mainRowHandleCount(options.pane4Open) * PANE_RESIZE_HANDLE_WIDTH_PX;
  return (
    options.totalWidth -
    widths.pane1 -
    widths.pane2 -
    pane4EffectiveWidth(widths, options.pane4Open) -
    handles
  );
}

/** 利用可能幅に収めつつ pane3 最小幅 520 を守る */
export function fitPaneLayout(input: FitPaneLayoutInput): WorkspacePaneWidths {
  let widths = clampRequestedWidths(input.requested);
  const expandPane = input.expandPane ?? null;
  const shrinkOrder = shrinkOrderFor(input);

  for (;;) {
    const pane3 = computePane3Width(widths, {
      totalWidth: input.totalWidth,
      pane4Open: input.pane4Open,
    });
    if (pane3 >= PANE3_MIN_WIDTH) {
      return widths;
    }

    const deficit = PANE3_MIN_WIDTH - pane3;
    let remaining = deficit;

    for (const pane of shrinkOrder) {
      if (remaining <= 0) break;
      if (pane === expandPane) continue;
      if (pane === "pane4" && !input.pane4Open) continue;

      const { min } = PANE_WIDTH_LIMITS[pane];
      const canShrink = widths[pane] - min;
      if (canShrink <= 0) continue;

      const take = Math.min(canShrink, remaining);
      widths = { ...widths, [pane]: widths[pane] - take };
      remaining -= take;
    }

    if (remaining > 0) {
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

/** 設定モーダル用: 範囲内に収めたうえで PANE_WIDTH_STEP 刻みに丸める */
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
    pane4: snapPaneWidth("pane4", widths.pane4),
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
      pane4: clampPaneWidth("pane4", parsed.pane4 ?? defaults.pane4),
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
