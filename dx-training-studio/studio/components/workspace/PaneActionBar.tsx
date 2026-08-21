"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** 左スロット: AI が下書きを作る操作（「原文から翻訳」等）。無い面では省略する */
  aiSlot?: ReactNode;
  /** 右スロット: 人が正本に書く操作（保存）。自動保存の面では省略する */
  saveSlot?: ReactNode;
  /**
   * 追従のさせ方。
   * - `sticky`（既定）: 本文スクロールコンテナの**内側**に置く。メタビュー向け
   * - `overlay`: 本文の上に重ねる。CodeMirror のように内部が独自のスクロール
   *   コンテナになっていて sticky が効かない面（レッスン本文）向け
   */
  variant?: "sticky" | "overlay";
  className?: string;
};

/**
 * 本文右上に置く操作ボタン列（studio-translation spec）。
 *
 * 並びは **左＝AI が下書きを作る / 右＝人が正本に書く** で固定する。
 * 「AI は正本に書かない」という規則を配置そのもので見せるための順序なので、
 * 面の都合で入れ替えないこと。
 *
 * ⚠ `sticky` は本文のスクロールコンテナの**内側**に置くこと（`position: sticky`
 * はスクロールする祖先に対して効く）。背景色を明示しているのは、下を流れる
 * コンテンツが透けないようにするため。
 */
export function PaneActionBar({
  aiSlot,
  saveSlot,
  variant = "sticky",
  className,
}: Props) {
  if (!aiSlot && !saveSlot) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2",
        variant === "sticky"
          ? "sticky top-0 z-10 -mt-1 bg-card pt-1 pb-2"
          : "pointer-events-none absolute top-2 right-4 z-10 [&>*]:pointer-events-auto",
        className,
      )}
    >
      {aiSlot}
      {saveSlot}
    </div>
  );
}
