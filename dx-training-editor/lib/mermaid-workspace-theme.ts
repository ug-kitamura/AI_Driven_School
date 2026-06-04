/** ワークスペース曼陀羅（グローバル / ミニ）用 Mermaid 設定 */

const FLOWCHART_LAYOUT = {
  nodeSpacing: 48,
  rankSpacing: 48,
  padding: 14,
  diagramPadding: 12,
  useMaxWidth: false,
  /** グローバル曼陀羅のシリーズ名（subgraph タイトル）上下の余白 */
  subGraphTitleMargin: {
    top: 10,
    bottom: 10,
  },
} as const;

const FLOWCHART_LAYOUT_COMPACT = {
  nodeSpacing: 36,
  rankSpacing: 36,
  padding: 12,
  diagramPadding: 10,
  useMaxWidth: true,
} as const;

/** Pane2 サムネイル用（useMaxWidth だと親 width 未定で SVG が潰れることがある） */
const FLOWCHART_LAYOUT_THUMBNAIL = {
  nodeSpacing: 36,
  rankSpacing: 36,
  padding: 12,
  diagramPadding: 10,
  useMaxWidth: false,
} as const;

const LIGHT_THEME_VARIABLES = {
  fontSize: "14px",
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
  fontSize: "14px",
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
  clusterBorder: "#383d43",
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

export function getMermaidWorkspaceConfig(
  isDark: boolean,
  options?: { compact?: boolean; thumbnail?: boolean },
) {
  const flowchart = options?.thumbnail
    ? FLOWCHART_LAYOUT_THUMBNAIL
    : options?.compact
      ? FLOWCHART_LAYOUT_COMPACT
      : FLOWCHART_LAYOUT;
  return {
    startOnLoad: false,
    theme: "base" as const,
    securityLevel: "loose" as const,
    flowchart,
    themeVariables: isDark ? DARK_THEME_VARIABLES : LIGHT_THEME_VARIABLES,
  };
}
