"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EditLanguage = "ja" | "en";

type Props = {
  language: EditLanguage;
  onLanguageChange: (language: EditLanguage) => void;
};

/**
 * 言語ビュー切替（studio-translation spec）。
 * 4か所のヘッダー（全体/シリーズ/コースビュー・レッスンのペイン2）で共有する。
 *
 * ⚠ ここに鮮度チップや保存ボタンを足さないこと。ヘッダーは「見る場所を切り替える」
 * だけの場所で、何かを起こす操作は本文右上の `PaneActionBar` に置く規則。
 * 翻訳が古いことは英語ビュー本文上部の赤字1行（`StaleTranslationNotice`）が伝える。
 */
export function LanguageToggleControl({ language, onLanguageChange }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6 shrink-0", language === "en" && "bg-accent")}
      aria-label={
        language === "ja" ? "英語ビューに切り替え" : "日本語ビューに戻す"
      }
      aria-pressed={language === "en"}
      title={language === "ja" ? "英語ビューに切り替え" : "日本語ビューに戻す"}
      onClick={() => onLanguageChange(language === "ja" ? "en" : "ja")}
    >
      <Languages className="h-3 w-3" />
    </Button>
  );
}
