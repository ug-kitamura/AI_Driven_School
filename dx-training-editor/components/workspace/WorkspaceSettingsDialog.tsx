"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  META_DIALOG_STACK,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import {
  PANE_WIDTH_DEFAULTS,
  PANE_WIDTH_LIMITS,
  clampPaneWidth,
  savePaneWidths,
  type WorkspacePaneWidths,
} from "@/components/workspace/pane-layout";
import {
  isAiApiKeyConfiguredOnServer,
  isPixabayApiKeyConfiguredOnServer,
} from "@/lib/api-keys";
import {
  applyThemeToDocument,
  loadWorkspaceSettings,
  saveWorkspaceSettings,
  type ThemeMode,
  type WorkspaceSettings,
} from "@/lib/workspace-settings";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPaneWidths: WorkspacePaneWidths;
  onApplyPaneWidths: (widths: WorkspacePaneWidths) => void;
};

function SettingsForm({
  onOpenChange,
  currentPaneWidths,
  onApplyPaneWidths,
}: Omit<Props, "open">) {
  const initial = loadWorkspaceSettings();
  const [draft, setDraft] = useState<WorkspaceSettings>(initial);
  const [apiKeyInput, setApiKeyInput] = useState(initial.aiApiKey ?? "");
  const [pixabayKeyInput, setPixabayKeyInput] = useState(initial.pixabayApiKey ?? "");
  const aiEnvConfigured = isAiApiKeyConfiguredOnServer();
  const pixabayEnvConfigured = isPixabayApiKeyConfiguredOnServer();

  const handleSave = () => {
    const next: WorkspaceSettings = {
      ...draft,
      aiApiKey: apiKeyInput.trim() || null,
      pixabayApiKey: pixabayKeyInput.trim() || null,
      paneDefaults: {
        pane1: clampPaneWidth("pane1", draft.paneDefaults.pane1),
        pane2: clampPaneWidth("pane2", draft.paneDefaults.pane2),
        pane4: clampPaneWidth("pane4", draft.paneDefaults.pane4),
      },
    };
    saveWorkspaceSettings(next);
    applyThemeToDocument(next.theme);
    onOpenChange(false);
  };

  const handleApplyLayout = () => {
    const widths = {
      pane1: clampPaneWidth("pane1", draft.paneDefaults.pane1),
      pane2: clampPaneWidth("pane2", draft.paneDefaults.pane2),
      pane4: clampPaneWidth("pane4", draft.paneDefaults.pane4),
    };
    savePaneWidths(widths);
    onApplyPaneWidths(widths);
  };

  const handleResetPaneDefaults = () => {
    setDraft((prev) => ({
      ...prev,
      paneDefaults: { ...PANE_WIDTH_DEFAULTS },
    }));
  };

  const handleUseCurrentWidths = () => {
    setDraft((prev) => ({
      ...prev,
      paneDefaults: { ...currentPaneWidths },
    }));
  };

  return (
    <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>
        <div className={META_DIALOG_STACK}>
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">テーマ</h3>
            <MetaDialogField>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["light", "ライト"],
                    ["dark", "ダーク"],
                    ["system", "システム"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={draft.theme === value ? "default" : "outline"}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, theme: value as ThemeMode }))
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </MetaDialogField>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              横幅
            </h3>
            {(["pane1", "pane2", "pane4"] as const).map((pane) => {
              const limits = PANE_WIDTH_LIMITS[pane];
              const labels = {
                pane1: "Pane 1",
                pane2: "Pane 2",
                pane4: "Pane 4",
              };
              return (
                <MetaDialogField key={pane}>
                  <Label className="text-xs text-muted-foreground">
                    {labels[pane]} ({limits.min}–{limits.max})
                  </Label>
                  <Input
                    type="number"
                    min={limits.min}
                    max={limits.max}
                    value={draft.paneDefaults[pane]}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setDraft((prev) => ({
                        ...prev,
                        paneDefaults: {
                          ...prev.paneDefaults,
                          [pane]: clampPaneWidth(pane, Number.isFinite(n) ? n : limits.min),
                        },
                      }));
                    }}
                  />
                </MetaDialogField>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleUseCurrentWidths}>
                現在の幅を反映
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleApplyLayout}>
                今のレイアウトに適用
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleResetPaneDefaults}>
                リセット
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">API</h3>
            <MetaDialogField>
              <Label className="text-xs text-muted-foreground">
                AI API キー
              </Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder="sk-ant-..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                disabled={aiEnvConfigured}
              />
              <p className="text-[10px] text-muted-foreground">
                {aiEnvConfigured ? (
                  <>
                    サーバー環境変数 <code className="text-[9px]">AI_API_KEY</code>{" "}
                    を使用中（ダイアログの値は無視されます）
                  </>
                ) : (
                  <>
                    未設定時はリクエストヘッダー{" "}
                    <code className="text-[9px]">x-ai-api-key</code> として送信。
                    推奨: <code className="text-[9px]">.env.local</code> に{" "}
                    <code className="text-[9px]">AI_API_KEY</code>
                  </>
                )}
              </p>
            </MetaDialogField>
            <MetaDialogField>
              <Label className="text-xs text-muted-foreground">
                Pixabay API キー
              </Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder="Pixabay API key"
                value={pixabayKeyInput}
                onChange={(e) => setPixabayKeyInput(e.target.value)}
                disabled={pixabayEnvConfigured}
              />
              <p className="text-[10px] text-muted-foreground">
                {pixabayEnvConfigured ? (
                  <>
                    サーバー環境変数{" "}
                    <code className="text-[9px]">PIXABAY_API_KEY</code>{" "}
                    を使用中
                  </>
                ) : (
                  <>
                    未設定時はヘッダー{" "}
                    <code className="text-[9px]">x-pixabay-api-key</code>。
                    推奨: <code className="text-[9px]">.env.local</code>
                  </>
                )}
              </p>
            </MetaDialogField>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setApiKeyInput("");
                setPixabayKeyInput("");
              }}
            >
              API キーをクリア
            </Button>
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button type="button" onClick={handleSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}

export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
  currentPaneWidths,
  onApplyPaneWidths,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <SettingsForm
          onOpenChange={onOpenChange}
          currentPaneWidths={currentPaneWidths}
          onApplyPaneWidths={onApplyPaneWidths}
        />
      ) : null}
    </Dialog>
  );
}
