import {
  PANE_WIDTH_DEFAULTS,
  clampPaneWidth,
  type WorkspacePaneWidths,
} from "@/components/workspace/pane-layout";
import {
  DEFAULT_AI_MODEL,
  normalizeAiModel,
  type AiModelSlug,
} from "@/lib/ai-models";
import {
  EDITOR_FONT_SIZE_CHANGED_EVENT as STORAGE_EDITOR_FONT_SIZE_CHANGED_EVENT,
  STORAGE_KEYS,
  WORKSPACE_SETTINGS_CHANGED_EVENT as STORAGE_WORKSPACE_SETTINGS_CHANGED_EVENT,
} from "@/lib/storage-keys";

export type { AiModelSlug };

/**
 * `pink` は独立したモードで、`dark` とは排他。OS の明暗設定とは合成しない
 * （ピンクのダークモードは無い）——`html:not(.dark)` 基準の hljs・CodeMirror が
 * そのままライト配色で効くことが、この排他性の見返り。
 */
export type ThemeMode = "light" | "dark" | "system" | "pink";

export const EDITOR_FONT_SIZE_DEFAULT = 14;
export const EDITOR_FONT_SIZE_MIN = 8;
export const EDITOR_FONT_SIZE_MAX = 32;

export const EDITOR_FONT_SIZE_CHANGED_EVENT =
  STORAGE_EDITOR_FONT_SIZE_CHANGED_EVENT;
export const WORKSPACE_SETTINGS_CHANGED_EVENT =
  STORAGE_WORKSPACE_SETTINGS_CHANGED_EVENT;

export type WorkspaceSettings = {
  aiApiKey: string | null;
  searchApiKey: string | null;
  aiModel: AiModelSlug;
  theme: ThemeMode;
  paneDefaults: WorkspacePaneWidths;
  editorFontSizePx: number;
};

export function clampEditorFontSizePx(value: number): number {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return EDITOR_FONT_SIZE_DEFAULT;
  return Math.min(EDITOR_FONT_SIZE_MAX, Math.max(EDITOR_FONT_SIZE_MIN, n));
}

const STORAGE_KEY = STORAGE_KEYS.settings;

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  aiApiKey: null,
  searchApiKey: null,
  aiModel: DEFAULT_AI_MODEL,
  theme: "system",
  paneDefaults: { ...PANE_WIDTH_DEFAULTS },
  editorFontSizePx: EDITOR_FONT_SIZE_DEFAULT,
};

function normalizePaneDefaults(
  raw: Partial<WorkspacePaneWidths> | undefined,
): WorkspacePaneWidths {
  return {
    pane1: clampPaneWidth("pane1", raw?.pane1 ?? PANE_WIDTH_DEFAULTS.pane1),
    pane2: PANE_WIDTH_DEFAULTS.pane2,
    pane3: clampPaneWidth("pane3", raw?.pane3 ?? PANE_WIDTH_DEFAULTS.pane3),
  };
}

export function loadWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_WORKSPACE_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WORKSPACE_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<WorkspaceSettings> & {
      paneDefaults?: Partial<WorkspacePaneWidths & { pane4?: number }>;
    };
    const paneDefaults = parsed.paneDefaults;
    const migratedPaneDefaults: Partial<WorkspacePaneWidths> | undefined =
      paneDefaults
        ? {
            pane1: paneDefaults.pane1,
            pane3: paneDefaults.pane3 ?? paneDefaults.pane4,
          }
        : undefined;
    return {
      aiApiKey: typeof parsed.aiApiKey === "string" ? parsed.aiApiKey : null,
      searchApiKey:
        typeof parsed.searchApiKey === "string" ? parsed.searchApiKey : null,
      aiModel: normalizeAiModel(parsed.aiModel),
      theme:
        parsed.theme === "dark" ||
        parsed.theme === "system" ||
        parsed.theme === "light" ||
        parsed.theme === "pink"
          ? parsed.theme
          : DEFAULT_WORKSPACE_SETTINGS.theme,
      paneDefaults: normalizePaneDefaults(migratedPaneDefaults),
      editorFontSizePx: clampEditorFontSizePx(
        typeof parsed.editorFontSizePx === "number"
          ? parsed.editorFontSizePx
          : EDITOR_FONT_SIZE_DEFAULT,
      ),
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(WORKSPACE_SETTINGS_CHANGED_EVENT));
  } catch {
    // ignore quota
  }
}

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

export function resolveThemeClass(theme: ThemeMode): "light" | "dark" | "pink" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  // ピンクは OS の明暗設定を見ない。暗い環境で選んでも明るい画面になる
  if (theme === "pink") return "pink";
  // ⚠ window があっても matchMedia があるとは限らない（jsdom・一部の WebView）。
  // `system` の解決だけがこれを必要とするので、無ければライトへ倒す
  if (typeof window === "undefined") return "light";
  if (typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  const resolved = resolveThemeClass(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.classList.toggle("pink", resolved === "pink");
}
