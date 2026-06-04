/** ワークスペース曼陀羅（グローバル / ミニ）用 Mermaid 設定 */

const FLOWCHART_LAYOUT = {
  nodeSpacing: 36,
  rankSpacing: 36,
  padding: 10,
  diagramPadding: 8,
  useMaxWidth: false,
} as const;

const LIGHT_THEME_VARIABLES = {
  fontSize: "12px",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  primaryColor: "#D1E4FF",
  primaryTextColor: "#1A1C1D",
  primaryBorderColor: "#007BC0",
  lineColor: "#71767C",
  secondaryColor: "#EFF1F2",
  tertiaryColor: "#FFFFFF",
  mainBkg: "#FFFFFF",
  nodeBorder: "#D0D4D8",
  clusterBkg: "#EFF1F2",
  titleColor: "#1A1C1D",
  edgeLabelBackground: "#FFFFFF",
} as const;

const DARK_THEME_VARIABLES = {
  fontSize: "12px",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  primaryColor: "#2d4a6f",
  primaryTextColor: "#e8e8e8",
  primaryBorderColor: "#7eb8e8",
  lineColor: "#9ca3af",
  secondaryColor: "#2a2d2e",
  tertiaryColor: "#1e1e1e",
  mainBkg: "#2a2d2e",
  nodeBorder: "#4b5563",
  clusterBkg: "#252526",
  titleColor: "#e8e8e8",
  edgeLabelBackground: "#2a2d2e",
} as const;

/** 曼陀羅の現在コース枠線（ライト / ダーク共通） */
const MANDALA_CURRENT_COURSE_STROKE = "#5E94BE";

export function mandalaCurrentCourseStyleLine(
  nodeId: string,
  strokeWidthPx: number,
): string {
  return `  style ${nodeId} stroke:${MANDALA_CURRENT_COURSE_STROKE},stroke-width:${strokeWidthPx}px,font-weight:bold`;
}

export function getMermaidWorkspaceConfig(isDark: boolean, options?: { compact?: boolean }) {
  const compact = options?.compact ?? false;
  return {
    startOnLoad: false,
    theme: "base" as const,
    securityLevel: "loose" as const,
    flowchart: compact
      ? {
          nodeSpacing: 28,
          rankSpacing: 28,
          padding: 8,
          diagramPadding: 6,
          useMaxWidth: true,
        }
      : FLOWCHART_LAYOUT,
    themeVariables: isDark ? DARK_THEME_VARIABLES : LIGHT_THEME_VARIABLES,
  };
}
