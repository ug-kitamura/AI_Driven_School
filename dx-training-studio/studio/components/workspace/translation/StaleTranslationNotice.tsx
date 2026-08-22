"use client";

import { STALE_NOTICE_TEXT } from "@/components/workspace/translation/translationLabels";
import type { TranslationFreshness } from "@/lib/translation/client";
import { cn } from "@/lib/utils";

type Props = {
  /** 未取得（ロード中）は undefined。`stale` のときだけ描く */
  status: TranslationFreshness | undefined;
  /** 置き場ごとの体裁（レッスン本文ヘッダーでは `shrink-0` で並べる） */
  className?: string;
};

/**
 * 英語ビューの赤字1行（studio-translation spec）。
 *
 * 置き場は面の種類で決まる——メタ編集面とレッスンメタモーダルは**本文上部**、
 * レッスン本文は**ペイン2 ヘッダーのタイトル右隣**（本文の高さを鮮度で変えない）。
 *
 * ⚠ 文言以外を足さないこと。操作も補足も付けない——「翻訳が古い」と気づける
 * のはトレーナーだけで、直す手段（本文右上の「原文から翻訳」）は既に見えている。
 * `untranslated` で出さないのは、英語欄が空であること自体が合図になるため。
 * 日本語ビューでは呼び出し側が描かない。
 */
export function StaleTranslationNotice({ status, className }: Props) {
  if (status !== "stale") return null;
  return (
    <p className={cn("text-xs text-destructive", className)}>
      {STALE_NOTICE_TEXT}
    </p>
  );
}
