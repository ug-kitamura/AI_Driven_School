/** ワークスペース曼陀羅（グローバル / ミニ）用 Mermaid 設定 */

/** ミニ曼陀羅拡大モーダルなど */
const FLOWCHART_LAYOUT = {
  nodeSpacing: 48,
  rankSpacing: 48,
  padding: 14,
  diagramPadding: 12,
  useMaxWidth: false,
  subGraphTitleMargin: {
    top: 10,
    bottom: 10,
  },
} as const;

/** ヘッダー「DXトレーニング曼陀羅」用（全体をややコンパクトに） */
const FLOWCHART_LAYOUT_GLOBAL = {
  nodeSpacing: 42,
  rankSpacing: 42,
  padding: 12,
  diagramPadding: 10,
  useMaxWidth: false,
  subGraphTitleMargin: {
    top: 8,
    bottom: 20,
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
export const MANDALA_CURRENT_COURSE_STROKE = "#5E94BE";

export function mandalaCurrentCourseStyleLine(
  nodeId: string,
  strokeWidthPx: number,
): string {
  return `  style ${nodeId} stroke:${MANDALA_CURRENT_COURSE_STROKE},stroke-width:${strokeWidthPx}px,font-weight:bold`;
}

/** Pane2 サムネイル: 固定 width 属性を外し、親幅に CSS で追従させる */
export function scaleMiniMandalaThumbnailSvg(svg: string): string {
  return svg.replace(/^<svg\b([^>]*)>/i, (_, attrs: string) => {
    const cleaned = attrs
      .replace(/\s+width="[^"]*"/gi, "")
      .replace(/\s+height="[^"]*"/gi, "")
      .replace(/\s+style="[^"]*"/gi, "");
    return `<svg${cleaned} preserveAspectRatio="xMidYMid meet" style="width:100%;max-width:100%;height:auto;display:block">`;
  });
}

export function getMermaidWorkspaceConfig(
  isDark: boolean,
  options?: { compact?: boolean; thumbnail?: boolean; global?: boolean },
) {
  const flowchart = options?.thumbnail
    ? FLOWCHART_LAYOUT_THUMBNAIL
    : options?.compact
      ? FLOWCHART_LAYOUT_COMPACT
      : options?.global
        ? FLOWCHART_LAYOUT_GLOBAL
        : FLOWCHART_LAYOUT;
  const baseTheme = isDark ? DARK_THEME_VARIABLES : LIGHT_THEME_VARIABLES;
  const themeVariables = options?.global
    ? { ...baseTheme, fontSize: "13px" }
    : baseTheme;
  return {
    startOnLoad: false,
    theme: "base" as const,
    securityLevel: "loose" as const,
    flowchart,
    themeVariables,
  };
}
