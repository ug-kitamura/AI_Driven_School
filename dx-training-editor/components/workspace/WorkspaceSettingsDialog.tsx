"use client";

import { useState } from "react";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
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
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  applyThemeToDocument,
  clampEditorFontSizePx,
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

function ApiKeyField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <MetaDialogField>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={visible ? "マスク表示" : "表示"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`${label}をリセット`}
          onClick={() => onChange("")}
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </MetaDialogField>
  );
}

function SettingsForm({
  onOpenChange,
  currentPaneWidths,
  onApplyPaneWidths,
}: Omit<Props, "open">) {
  const initial = loadWorkspaceSettings();
  const [draft, setDraft] = useState<WorkspaceSettings>(initial);
  const [apiKeyInput, setApiKeyInput] = useState(initial.aiApiKey ?? "");
  const [pixabayKeyInput, setPixabayKeyInput] = useState(initial.pixabayApiKey ?? "");

  const handleSave = () => {
    const next: WorkspaceSettings = {
      ...draft,
      aiApiKey: apiKeyInput.trim() || null,
      pixabayApiKey: pixabayKeyInput.trim() || null,
      editorFontSizePx: clampEditorFontSizePx(draft.editorFontSizePx),
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

  const paneLabels = {
    pane1: "Pane 1",
    pane2: "Pane 2",
    pane4: "Pane 4",
  } as const;

  return (
    <DialogContent className="max-w-lg">
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
            <h3 className="text-sm font-semibold text-foreground">編集</h3>
            <MetaDialogField>
              <Label className="text-xs text-muted-foreground">
                編集エリアのデフォルトフォントサイズ（{EDITOR_FONT_SIZE_MIN}–
                {EDITOR_FONT_SIZE_MAX} px）
              </Label>
              <Input
                type="number"
                min={EDITOR_FONT_SIZE_MIN}
                max={EDITOR_FONT_SIZE_MAX}
                value={draft.editorFontSizePx}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setDraft((prev) => ({
                    ...prev,
                    editorFontSizePx: clampEditorFontSizePx(
                      Number.isFinite(n) ? n : prev.editorFontSizePx,
                    ),
                  }));
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                編集モードで Ctrl+ホイールでも変更できます
              </p>
            </MetaDialogField>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">横幅</h3>
            <div className="grid grid-cols-3 gap-2">
              {(["pane1", "pane2", "pane4"] as const).map((pane) => {
                const limits = PANE_WIDTH_LIMITS[pane];
                return (
                  <MetaDialogField key={pane}>
                    <Label className="text-xs text-muted-foreground">
                      {paneLabels[pane]}
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
                            [pane]: clampPaneWidth(
                              pane,
                              Number.isFinite(n) ? n : limits.min,
                            ),
                          },
                        }));
                      }}
                    />
                  </MetaDialogField>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleUseCurrentWidths}>
                現在の幅を反映
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleApplyLayout}>
                今のレイアウトに適用
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleResetPaneDefaults}
              >
                既定幅に戻す
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">API</h3>
            <ApiKeyField
              id="settings-ai-api-key"
              label="AI API キー"
              value={apiKeyInput}
              onChange={setApiKeyInput}
              placeholder="sk-ant-api03-..."
              hint="未入力時は環境変数 AI_API_KEY を取得"
            />
            <ApiKeyField
              id="settings-pixabay-api-key"
              label="Pixabay API キー"
              value={pixabayKeyInput}
              onChange={setPixabayKeyInput}
              placeholder="Pixabay API key"
              hint="未入力時は環境変数 PIXABAY_API_KEY を取得"
            />
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
