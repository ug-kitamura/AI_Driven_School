"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toImageApiUrl } from "@/lib/image-path";

export type LightboxItem = {
  name: string;
  path: string;
  statusLabel?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LightboxItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onInsert?: () => void;
  onDelete?: () => void;
  showInsert?: boolean;
  showDelete?: boolean;
};

export function ImageLightbox({
  open,
  onOpenChange,
  items,
  index,
  onIndexChange,
  onInsert,
  onDelete,
  showInsert = false,
  showDelete = false,
}: Props) {
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;
  const showActions =
    (showInsert && onInsert) || (showDelete && onDelete);

  useEffect(() => {
    if (!open) {
      setSizeLabel(null);
    }
  }, [open, item?.path]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(90dvh,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-[min(90vw,720px)] flex-col gap-3 overflow-y-auto overscroll-contain",
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="truncate pr-6 text-sm">
            {item.name}
            {items.length > 1 ? (
              <span className="ml-2 font-normal text-muted-foreground">
                ({index + 1}/{items.length})
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-2">
          {items.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!hasPrev}
              onClick={() => onIndexChange(index - 1)}
              aria-label="前の画像"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={item.path}
              src={toImageApiUrl(item.path)}
              alt={item.name}
              className="max-h-[min(48dvh,calc(90dvh-14rem))] w-full object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                setSizeLabel(`${img.naturalWidth} × ${img.naturalHeight}px`);
              }}
            />
          </div>

          {items.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={!hasNext}
              onClick={() => onIndexChange(index + 1)}
              aria-label="次の画像"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="shrink-0 space-y-0.5">
          <p className="truncate text-xs text-muted-foreground">{item.path}</p>
          {sizeLabel ? (
            <p className="text-xs tabular-nums text-muted-foreground">{sizeLabel}</p>
          ) : null}
          {item.statusLabel ? (
            <p className="text-xs text-muted-foreground">{item.statusLabel}</p>
          ) : null}
        </div>

        {showActions ? (
          <DialogFooter className="shrink-0 gap-1.5 sm:justify-end">
            {showInsert && onInsert ? (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={onInsert}
              >
                <Plus className="h-3.5 w-3.5" />
                挿入
              </Button>
            ) : null}
            {showDelete && onDelete ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8 gap-1 text-xs"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                削除
              </Button>
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
