"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  parsePurposeConcepts,
  type PurposeConcept,
} from "@/lib/purpose-concepts";
import typographyImage from "@/images/typography.png";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PARSE_ERROR = "ebe-purpose.md の見出しを解析できませんでした";
const LOAD_ERROR = "ebe-purpose.md を読み込めませんでした";

export function PurposeDialog({ open, onOpenChange }: Props) {
  const [concepts, setConcepts] = useState<PurposeConcept[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/purpose")
      .then(async (res) => {
        if (!res.ok) throw new Error(LOAD_ERROR);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        // 部分許容: 形式に合わない見出しは無視される。1 件も取れなければエラー。
        const parsed = parsePurposeConcepts(text);
        if (parsed.length === 0) {
          setError(PARSE_ERROR);
          setConcepts([]);
          return;
        }
        setConcepts(parsed);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleOpenChange = useCallback(
    (next: boolean) => onOpenChange(next),
    [onOpenChange],
  );

  return (
    <dialog
      open={open}
      onClose={() => handleOpenChange(false)}
      className={cn(
        // flex-col + 下の min-h-0 で「収まるなら全部出す／収まらなければ ol だけ
        // スクロールさせる」高さの連鎖を作る
        "fixed inset-0 z-50 m-auto flex max-h-[97vh] w-full max-w-3xl flex-col rounded-sm border border-[#c4b896] p-0 shadow-xl backdrop:bg-black/50",
        "bg-[#e8dfc8] text-[#3d3426]",
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-col gap-5 px-[30px] py-8">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="閉じる"
          className="absolute top-4 right-4 text-[#3d3426]/80 hover:bg-[#d4c9a8] hover:text-[#3d3426]"
          onClick={() => handleOpenChange(false)}
        >
          <X className="size-4" />
        </Button>

        <Image
          src={typographyImage}
          alt="EBE Purpose"
          className="mx-auto h-auto w-full max-w-[12rem]"
          priority
        />

        {error ? (
          <p className="text-destructive text-center text-sm">{error}</p>
        ) : (
          <ol className="purpose-parchment workspace-scrollbar mx-auto flex w-full min-h-0 list-none flex-col gap-3 overflow-y-auto pl-0 text-center">
            {concepts.map((item) => (
              <li
                key={item.no}
                className="mx-auto flex w-full flex-col gap-0.5"
              >
                <p className="text-sm font-bold sm:text-base">
                  {item.no}. {item.concept}
                </p>
                <p className="text-xs leading-snug whitespace-pre-line">
                  {item.description}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </dialog>
  );
}
