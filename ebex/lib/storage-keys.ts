/** 旧 dx-training-studio キー（migration 用） */
export const LEGACY_STORAGE_KEYS = {
  settings: "dx-training-studio-settings",
  paneWidths: "dx-training-studio-pane-widths",
  agentChat: "dx-training-studio-agent-chat",
  agentChatV2: "dx-training-studio-agent-chat-v2",
  selection: "dx-training-studio-selection",
} as const;

export const STORAGE_KEYS = {
  settings: "ebex-settings",
  paneWidths: "ebex-pane-widths",
  agentChat: "ebex-agent-chat",
  agentChatV2: "ebex-agent-chat-v2",
  selection: "ebex-selection",
  lastFile: "ebex-last-file",
} as const;

export const EDITOR_FONT_SIZE_CHANGED_EVENT = "ebex-font-size-changed";
export const WORKSPACE_SETTINGS_CHANGED_EVENT = "ebex-settings-changed";

/** migration 対象: [旧キー, 新キー] */
export const LOCAL_STORAGE_MIGRATION_PAIRS: ReadonlyArray<
  readonly [string, string]
> = [
  [LEGACY_STORAGE_KEYS.settings, STORAGE_KEYS.settings],
  [LEGACY_STORAGE_KEYS.paneWidths, STORAGE_KEYS.paneWidths],
  [LEGACY_STORAGE_KEYS.agentChat, STORAGE_KEYS.agentChat],
  [LEGACY_STORAGE_KEYS.selection, STORAGE_KEYS.selection],
  ["dx-training-editor-settings", STORAGE_KEYS.settings],
  ["dx-training-editor-pane-widths", STORAGE_KEYS.paneWidths],
  ["dx-training-editor-agent-chat", STORAGE_KEYS.agentChat],
  ["dx-training-editor-selection", STORAGE_KEYS.selection],
];
