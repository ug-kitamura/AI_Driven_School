"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    if (!open) {
      setSizeLabel(null);
    }
  }, [open, item?.path]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(90vw,720px)] gap-3">
        <DialogHeader>
          <DialogTitle className="truncate text-sm">
            {item.name}
            {items.length > 1 ? (
              <span className="ml-2 font-normal text-muted-foreground">
                ({index + 1}/{items.length})
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <div className="relative overflow-hidden rounded border border-border bg-muted">
          {items.length > 1 ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 opacity-90"
                disabled={!hasPrev}
                onClick={() => onIndexChange(index - 1)}
                aria-label="前の画像"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 opacity-90"
                disabled={!hasNext}
                onClick={() => onIndexChange(index + 1)}
                aria-label="次の画像"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={item.path}
            src={toImageApiUrl(item.path)}
            alt={item.name}
            className="max-h-[70vh] w-full object-contain"
            onLoad={(e) => {
              const img = e.currentTarget;
              setSizeLabel(`${img.naturalWidth} × ${img.naturalHeight}px`);
            }}
          />
          {(showInsert || showDelete) && (onInsert || onDelete) ? (
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              {showInsert && onInsert ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 text-xs shadow-md"
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
                  className="h-8 gap-1 text-xs shadow-md"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  削除
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">{item.path}</p>
        {sizeLabel ? (
          <p className="text-xs tabular-nums text-muted-foreground">{sizeLabel}</p>
        ) : null}
        {item.statusLabel ? (
          <p className="text-xs text-muted-foreground">{item.statusLabel}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
