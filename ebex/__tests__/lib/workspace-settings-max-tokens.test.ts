import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  loadWorkspaceSettings,
} from "@/lib/workspace-settings";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { DEFAULT_MAX_OUTPUT_TOKENS } from "@/lib/ai-models";

describe("loadWorkspaceSettings maxOutputTokens", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to 32000 when settings are absent", () => {
    expect(DEFAULT_MAX_OUTPUT_TOKENS).toBe(32000);
    expect(loadWorkspaceSettings().maxOutputTokens).toBe(32000);
    expect(DEFAULT_WORKSPACE_SETTINGS.maxOutputTokens).toBe(32000);
  });

  it("keeps explicitly saved 8192 without rewriting to 32000", () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({
        ...DEFAULT_WORKSPACE_SETTINGS,
        maxOutputTokens: 8192,
      }),
    );
    expect(loadWorkspaceSettings().maxOutputTokens).toBe(8192);
    expect(localStorage.getItem(STORAGE_KEYS.settings)).toContain("8192");
  });
});
