export type WorkspacePaneWidths = {
  pane1: number;
  pane2: number;
  pane4: number;
};

export const PANE_WIDTH_DEFAULTS: WorkspacePaneWidths = {
  pane1: 275,
  pane2: 300,
  pane4: 300,
};

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

const STORAGE_KEY = "dx-training-editor-pane-widths";
const SETTINGS_STORAGE_KEY = "dx-training-editor-settings";

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
