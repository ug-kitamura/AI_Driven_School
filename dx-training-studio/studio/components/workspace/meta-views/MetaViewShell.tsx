"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PaneKindBadge } from "@/components/workspace/metaDialogLayout";

type Props = {
  /** ヘッダーに出す階層名（例: シリーズ名） */
  title: string;
  /** タイトル横の階層種別ラベル（例: 全体 / シリーズ / コース） */
  kindLabel: string;
  onSave: () => void;
  saveDisabled?: boolean;
  children: ReactNode;
};

/**
 * ペイン2 のメタビュー共通シェル。
 * MarkdownEditorPane と同じ h-12 ヘッダー＋スクロール本文の構成。
 */
export function MetaViewShell({
  title,
  kindLabel,
  onSave,
  saveDisabled = false,
  children,
}: Props) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 py-0">
        <PaneKindBadge>{kindLabel}</PaneKindBadge>
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {title}
        </h2>
        <div className="ml-auto">
          <Button size="sm" onClick={onSave} disabled={saveDisabled}>
            保存
          </Button>
        </div>
      </div>
      <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
