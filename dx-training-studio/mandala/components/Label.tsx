import { formatLessonStatus, type LessonStatus } from "@/lib/site-data";
import type { Locale } from "@/lib/locale-path";

/**
 * ラベルの種別。配色は種別で決まる（状態=赤系 / 所要時間=緑系 / 受講形態=青系）。
 * 目次（コーストップの一覧）とレッスンページのラベル行で同じ部品を使う——
 * 同じ意味の値が場所によって違う言葉・違う色になるのを防ぐため。
 */
export type LabelKind = "status" | "minutes" | "style" | "note";

export function Label({
  kind,
  children,
}: {
  kind: LabelKind;
  children: React.ReactNode;
}) {
  return <span className={`dxm-label dxm-label-${kind}`}>{children}</span>;
}

/** 執筆状況のラベル。`done` には出さない */
export function StatusLabel({
  status,
  locale = "ja",
}: {
  status: LessonStatus;
  locale?: Locale;
}) {
  const label = formatLessonStatus(status, locale);
  if (!label) return null;
  return <Label kind="status">{label}</Label>;
}

/** 翻訳バッジの状態（translation-freshness spec。fresh はバッジ自体を出さない） */
export type TranslationBadge = "untranslated" | "stale";

/**
 * 翻訳の状態バッジ。en ページ専用。
 * `untranslated`=英語版が無く日本語を表示 / `stale`=英語版が原文より古い
 */
export function TranslationLabel({
  state,
  locale,
}: {
  state: TranslationBadge;
  locale: Locale;
}) {
  if (locale !== "en") return null;
  return (
    <Label kind="note">
      {state === "untranslated"
        ? "Not translated yet — showing Japanese"
        : "Translation may be outdated"}
    </Label>
  );
}
