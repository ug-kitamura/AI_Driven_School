export type WorkspacePaneWidths = {
  pane1: number;
  pane2: number;
  pane3: number;
};

export const PANE_WIDTH_DEFAULTS: WorkspacePaneWidths = {
  pane1: 300,
  pane2: 600,
  pane3: 600,
};

/** Pane 2（エディタ）の最小幅 — 派生幅のため永続化・設定 UI には含めない */
export const PANE2_MIN_WIDTH = 400;

/** 各ペインの最小幅 */
export const PANE_MIN_WIDTHS: Record<keyof WorkspacePaneWidths, number> = {
  pane1: 200,
  pane2: PANE2_MIN_WIDTH,
  pane3: 400,
};

/** ウィンドウリサイズ等: pane2 不足時の縮小順（pane2 は派生のため含めない） */
export const PANE_SHRINK_ORDER_DEFAULT: (keyof WorkspacePaneWidths)[] = [
  "pane3",
  "pane1",
];

/** 各ペインを広げる際に他ペインを縮める順（pane2 は派生のため含めない） */
export const PANE_SHRINK_ORDER_WHEN_EXPAND: Record<
  keyof WorkspacePaneWidths,
  (keyof WorkspacePaneWidths)[]
> = {
  pane1: ["pane3"],
  pane2: ["pane3", "pane1"],
  pane3: ["pane1"],
};

/** メインペイン行のリサイズハンドル 1 本あたりのレイアウト幅（px） */
export const PANE_RESIZE_HANDLE_WIDTH_PX = 8;

/** 設定モーダルでのペイン既定幅の変更刻み（px） */
export const PANE_WIDTH_STEP = 5;

export const PANE_WIDTH_LIMITS = {
  pane1: { min: 200, max: 400 },
  pane2: { min: PANE2_MIN_WIDTH, max: 1200 },
  pane3: { min: 400, max: 800 },
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

type StoredPaneWidths = Pick<WorkspacePaneWidths, "pane1" | "pane3">;

function loadPaneDefaultsFromSettings(): StoredPaneWidths {
  if (typeof window === "undefined") {
    return { pane1: PANE_WIDTH_DEFAULTS.pane1, pane3: PANE_WIDTH_DEFAULTS.pane3 };
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { pane1: PANE_WIDTH_DEFAULTS.pane1, pane3: PANE_WIDTH_DEFAULTS.pane3 };
    }
    const parsed = JSON.parse(raw) as {
      paneDefaults?: Partial<WorkspacePaneWidths & { pane4?: number }>;
    };
    const d = parsed.paneDefaults;
    return {
      pane1: clampPaneWidth("pane1", d?.pane1 ?? PANE_WIDTH_DEFAULTS.pane1),
      pane3: clampPaneWidth("pane3", d?.pane3 ?? PANE_WIDTH_DEFAULTS.pane3),
    };
  } catch {
    return { pane1: PANE_WIDTH_DEFAULTS.pane1, pane3: PANE_WIDTH_DEFAULTS.pane3 };
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampStoredWidths(requested: StoredPaneWidths): StoredPaneWidths {
  return {
    pane1: clampPaneWidth("pane1", requested.pane1),
    pane3: clampPaneWidth("pane3", requested.pane3),
  };
}

function mainRowHandleCount(): number {
  return 2;
}

function shrinkOrderFor(input: FitPaneLayoutInput): (keyof WorkspacePaneWidths)[] {
  if (input.expandPane) {
    return PANE_SHRINK_ORDER_WHEN_EXPAND[input.expandPane];
  }
  return PANE_SHRINK_ORDER_DEFAULT;
}

/** Pane 2 実幅（px）を算出する */
export function computePane2Width(
  widths: StoredPaneWidths,
  totalWidth: number,
): number {
  const handles = mainRowHandleCount() * PANE_RESIZE_HANDLE_WIDTH_PX;
  return totalWidth - widths.pane1 - widths.pane3 - handles;
}

function withDerivedPane2(
  widths: StoredPaneWidths,
  totalWidth: number,
): WorkspacePaneWidths {
  return {
    ...widths,
    pane2: computePane2Width(widths, totalWidth),
  };
}

/** pane2 最小幅を守りつつ pane1 / pane3 を調整する */
export function fitPaneLayout(input: FitPaneLayoutInput): WorkspacePaneWidths {
  let widths = clampStoredWidths({
    pane1: input.requested.pane1,
    pane3: input.requested.pane3,
  });
  const expandPane = input.expandPane ?? null;
  const shrinkOrder = shrinkOrderFor(input);

  for (;;) {
    const pane2 = computePane2Width(widths, input.totalWidth);
    if (pane2 >= PANE2_MIN_WIDTH) {
      return { ...widths, pane2 };
    }

    const deficit = PANE2_MIN_WIDTH - pane2;
    let remaining = deficit;

    for (const pane of shrinkOrder) {
      if (remaining <= 0) break;
      if (pane === expandPane || pane === "pane2") continue;

      const { min } = PANE_WIDTH_LIMITS[pane];
      const canShrink = widths[pane] - min;
      if (canShrink <= 0) continue;

      const take = Math.min(canShrink, remaining);
      widths = { ...widths, [pane]: widths[pane] - take };
      remaining -= take;
    }

    if (remaining > 0) {
      if (expandPane && expandPane !== "pane2") {
        widths = {
          ...widths,
          [expandPane]: clampPaneWidth(
            expandPane,
            widths[expandPane] - remaining,
          ),
        };
      }
      return withDerivedPane2(widths, input.totalWidth);
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
    ...widths,
    pane1: snapPaneWidth("pane1", widths.pane1),
    pane3: snapPaneWidth("pane3", widths.pane3),
  };
}

export function loadPaneWidths(): WorkspacePaneWidths {
  const defaults = loadPaneDefaultsFromSettings();
  if (typeof window === "undefined") {
    return { ...defaults, pane2: PANE_WIDTH_DEFAULTS.pane2 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults, pane2: PANE_WIDTH_DEFAULTS.pane2 };
    const parsed = JSON.parse(raw) as Partial<StoredPaneWidths>;
    const stored = clampStoredWidths({
      pane1: parsed.pane1 ?? defaults.pane1,
      pane3: parsed.pane3 ?? defaults.pane3,
    });
    return { ...stored, pane2: PANE_WIDTH_DEFAULTS.pane2 };
  } catch {
    return { ...defaults, pane2: PANE_WIDTH_DEFAULTS.pane2 };
  }
}

export function savePaneWidths(widths: WorkspacePaneWidths) {
  if (typeof window === "undefined") return;
  const stored: StoredPaneWidths = {
    pane1: widths.pane1,
    pane3: widths.pane3,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore quota errors
  }
}
