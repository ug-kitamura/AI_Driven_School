"use client";

import { STALE_NOTICE_TEXT } from "@/components/workspace/translation/translationLabels";
import type { TranslationFreshness } from "@/lib/translation/client";

type Props = {
  /** 未取得（ロード中）は undefined。`stale` のときだけ描く */
  status: TranslationFreshness | undefined;
};

/**
 * 英語ビュー本文上部の赤字1行（studio-translation spec）。
 *
 * ⚠ 文言以外を足さないこと。操作も補足も付けない——「翻訳が古い」と気づける
 * のはトレーナーだけで、直す手段（本文右上の「原文から翻訳」）は既に見えている。
 * `untranslated` で出さないのは、英語欄が空であること自体が合図になるため。
 * 日本語ビューでは呼び出し側が描かない。
 */
export function StaleTranslationNotice({ status }: Props) {
  if (status !== "stale") return null;
  return <p className="text-xs text-destructive">{STALE_NOTICE_TEXT}</p>;
}
