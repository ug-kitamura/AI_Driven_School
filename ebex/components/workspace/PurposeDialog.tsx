"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PurposeDialog({ open, onOpenChange }: Props) {
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/purpose")
      .then(async (res) => {
        if (!res.ok) throw new Error("purpose.md を読み込めませんでした");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setMarkdown(text);
          setError(null);
        }
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
        "fixed inset-0 z-50 m-auto max-h-[92vh] w-full max-w-3xl rounded-sm border border-[#c4b896] p-0 shadow-xl backdrop:bg-black/50",
        "bg-[#e8dfc8] text-[#3d3426]",
      )}
    >
      <div className="relative flex flex-col gap-10 px-10 py-12 sm:px-16 sm:py-14">
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

        <h2 className="text-center text-3xl font-semibold tracking-wide text-[#2c2418] sm:text-4xl">
          EBE Purpose
        </h2>

        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : (
          <div
            className={cn(
              "purpose-parchment workspace-scrollbar max-h-[70vh] overflow-y-auto text-center",
              "[&_h1]:hidden",
              "[&_ol]:mx-auto [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-4 [&_ol]:pl-0 [&_ol]:text-center [&_ol]:text-base [&_ol]:leading-relaxed sm:[&_ol]:text-lg",
              "[&_ul]:mx-auto [&_ul]:list-decimal [&_ul]:list-inside [&_ul]:space-y-4 [&_ul]:pl-0 [&_ul]:text-center [&_ul]:text-base [&_ul]:leading-relaxed sm:[&_ul]:text-lg",
              "[&_li]:text-center",
              "[&_p]:mx-auto [&_p]:max-w-prose [&_p]:text-center [&_p]:text-base [&_p]:leading-relaxed sm:[&_p]:text-lg",
            )}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </dialog>
  );
}
