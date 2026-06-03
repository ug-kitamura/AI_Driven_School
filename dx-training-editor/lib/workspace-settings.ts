import {
  PANE_WIDTH_DEFAULTS,
  clampPaneWidth,
  type WorkspacePaneWidths,
} from "@/components/workspace/pane-layout";

export type ThemeMode = "light" | "dark" | "system";

export type WorkspaceSettings = {
  anthropicApiKey: string | null;
  pixabayApiKey: string | null;
  theme: ThemeMode;
  paneDefaults: WorkspacePaneWidths;
};

const STORAGE_KEY = "dx-training-editor-settings";

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  anthropicApiKey: null,
  pixabayApiKey: null,
  theme: "light",
  paneDefaults: { ...PANE_WIDTH_DEFAULTS },
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
      anthropicApiKey:
        typeof parsed.anthropicApiKey === "string"
          ? parsed.anthropicApiKey
          : null,
      pixabayApiKey:
        typeof parsed.pixabayApiKey === "string" ? parsed.pixabayApiKey : null,
      theme:
        parsed.theme === "dark" ||
        parsed.theme === "system" ||
        parsed.theme === "light"
          ? parsed.theme
          : DEFAULT_WORKSPACE_SETTINGS.theme,
      paneDefaults: normalizePaneDefaults(parsed.paneDefaults),
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
