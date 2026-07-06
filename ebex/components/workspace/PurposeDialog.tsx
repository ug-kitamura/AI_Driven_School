"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
      className="fixed inset-0 z-50 m-auto max-h-[85vh] w-full max-w-2xl rounded-lg border bg-background p-0 shadow-lg backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">EBE Purpose</h2>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => handleOpenChange(false)}
          >
            閉じる
          </button>
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        )}
      </div>
    </dialog>
  );
}
