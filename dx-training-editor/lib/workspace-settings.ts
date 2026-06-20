import {
  PANE_WIDTH_DEFAULTS,
  clampPaneWidth,
  type WorkspacePaneWidths,
} from "@/components/workspace/pane-layout";

export type ThemeMode = "light" | "dark" | "system";
export type DisplayLanguage = "ja" | "en";

export const EDITOR_FONT_SIZE_DEFAULT = 14;
export const EDITOR_FONT_SIZE_MIN = 8;
export const EDITOR_FONT_SIZE_MAX = 32;

export const EDITOR_FONT_SIZE_CHANGED_EVENT = "dx-training-editor-font-size-changed";

export type WorkspaceSettings = {
  aiApiKey: string | null;
  pixabayApiKey: string | null;
  theme: ThemeMode;
  paneDefaults: WorkspacePaneWidths;
  editorFontSizePx: number;
  displayLanguage: DisplayLanguage;
};

export function clampEditorFontSizePx(value: number): number {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return EDITOR_FONT_SIZE_DEFAULT;
  return Math.min(EDITOR_FONT_SIZE_MAX, Math.max(EDITOR_FONT_SIZE_MIN, n));
}

const STORAGE_KEY = "dx-training-editor-settings";

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  aiApiKey: null,
  pixabayApiKey: null,
  theme: "light",
  paneDefaults: { ...PANE_WIDTH_DEFAULTS },
  editorFontSizePx: EDITOR_FONT_SIZE_DEFAULT,
  displayLanguage: "ja",
};

function normalizePaneDefaults(
  raw: Partial<WorkspacePaneWidths> | undefined,
): WorkspacePaneWidths {
  return {
    pane1: clampPaneWidth("pane1", raw?.pane1 ?? PANE_WIDTH_DEFAULTS.pane1),
    pane2: clampPaneWidth("pane2", raw?.pane2 ?? PANE_WIDTH_DEFAULTS.pane2),
    pane4: clampPaneWidth("pane4", raw?.pane4 ?? PANE_WIDTH_DEFAULTS.pane4),
  };
}

export function loadWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_WORKSPACE_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WORKSPACE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettings>;
    return {
      aiApiKey:
        typeof parsed.aiApiKey === "string" ? parsed.aiApiKey : null,
      pixabayApiKey:
        typeof parsed.pixabayApiKey === "string" ? parsed.pixabayApiKey : null,
      theme:
        parsed.theme === "dark" ||
        parsed.theme === "system" ||
        parsed.theme === "light"
          ? parsed.theme
          : DEFAULT_WORKSPACE_SETTINGS.theme,
      paneDefaults: normalizePaneDefaults(parsed.paneDefaults),
      editorFontSizePx: clampEditorFontSizePx(
        typeof parsed.editorFontSizePx === "number"
          ? parsed.editorFontSizePx
          : EDITOR_FONT_SIZE_DEFAULT,
      ),
      displayLanguage:
        parsed.displayLanguage === "en" || parsed.displayLanguage === "ja"
          ? parsed.displayLanguage
          : DEFAULT_WORKSPACE_SETTINGS.displayLanguage,
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota
  }
}

/** 設定モーダル等からエディタへ即時反映（localStorage も更新） */
export function applyEditorFontSizePx(px: number): number {
  const clamped = clampEditorFontSizePx(px);
  if (typeof window === "undefined") return clamped;
  saveWorkspaceSettings({
    ...loadWorkspaceSettings(),
    editorFontSizePx: clamped,
  });
  window.dispatchEvent(
    new CustomEvent(EDITOR_FONT_SIZE_CHANGED_EVENT, {
      detail: { px: clamped },
    }),
  );
  return clamped;
}

export function resolveThemeClass(theme: ThemeMode): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  const resolved = resolveThemeClass(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}
