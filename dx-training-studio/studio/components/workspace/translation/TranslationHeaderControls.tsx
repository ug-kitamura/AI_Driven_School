"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TranslationFreshness } from "@/lib/translation/client";

export type EditLanguage = "ja" | "en";

type Props = {
  language: EditLanguage;
  onLanguageChange: (language: EditLanguage) => void;
  /** 未取得（ロード中）は undefined。fresh はチップを出さない */
  status: TranslationFreshness | undefined;
  /** stale のときに出す「最新として扱う」。未提供なら出さない */
  onMarkFresh?: () => void;
};

/**
 * 言語ビュー切替＋鮮度チップ（studio-translation spec）。
 * 4か所のヘッダー（全体/シリーズ/コースビュー・レッスンのペイン2）で共有する。
 * チップはビューに属さず切替の横に常駐——日英どちらのビューでも見える。
 */
export function TranslationHeaderControls({
  language,
  onLanguageChange,
  status,
  onMarkFresh,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {status === "untranslated" ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          未翻訳
        </span>
      ) : status === "stale" ? (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
          英語版が古い
          {onMarkFresh ? (
            <button
              type="button"
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
              onClick={onMarkFresh}
              title="翻訳せず、現在の日本語版を訳出済みとして記録します"
            >
              最新として扱う
            </button>
          ) : null}
        </span>
      ) : null}
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
    </div>
  );
}
