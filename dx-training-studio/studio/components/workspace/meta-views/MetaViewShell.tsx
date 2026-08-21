"use client";

import type { ReactNode } from "react";
import { PaneKindBadge } from "@/components/workspace/metaDialogLayout";

type Props = {
  /** ヘッダーに出す階層名（例: シリーズ名） */
  title: string;
  /** タイトル横の階層種別ラベル（例: 全体 / シリーズ / コース） */
  kindLabel: string;
  /** ヘッダー右端に置くコントロール（言語切替）。⚠ 保存ボタンは置かない */
  headerExtra?: ReactNode;
  /**
   * 本文の先頭に差し込む sticky な操作ボタン列（`PaneActionBar`）。
   * ⚠ ヘッダーではなく本文スクロールコンテナの内側に置く——sticky を効かせるため
   */
  actionBar?: ReactNode;
  children: ReactNode;
};

/**
 * ペイン2 のメタビュー共通シェル。
 * MarkdownEditorPane と同じ h-12 ヘッダー＋スクロール本文の構成。
 *
 * 配置の規則（studio-translation spec）:
 * - ヘッダー = 見る場所を切り替える（言語切替だけ・右端）
 * - 本文右上 = 何かを起こす（`actionBar`。左＝AI が下書き / 右＝人が確定）
 *
 * ⚠ 保存ボタンをヘッダーに戻さないこと。日英で位置が変わるのを避けるため、
 * 言語による分岐もここには置かない。
 */
export function MetaViewShell({
  title,
  kindLabel,
  headerExtra,
  actionBar,
  children,
}: Props) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 py-0">
        <PaneKindBadge>{kindLabel}</PaneKindBadge>
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {title}
        </h2>
        <div className="ml-auto flex items-center gap-2">{headerExtra}</div>
      </div>
      <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {actionBar}
          {children}
        </div>
      </div>
    </div>
  );
}
