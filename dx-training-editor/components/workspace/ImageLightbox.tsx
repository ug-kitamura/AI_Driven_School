"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toImageApiUrl } from "@/lib/image-path";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  path: string;
  statusLabel?: string;
};

export function ImageLightbox({
  open,
  onOpenChange,
  name,
  path,
  statusLabel,
}: Props) {
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSizeLabel(null);
    }
  }, [open, path]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(90vw,720px)] gap-3">
        <DialogHeader>
          <DialogTitle className="truncate text-sm">{name}</DialogTitle>
        </DialogHeader>
        <div className="overflow-hidden rounded border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={toImageApiUrl(path)}
            alt={name}
            className="max-h-[70vh] w-full object-contain"
            onLoad={(e) => {
              const img = e.currentTarget;
              setSizeLabel(`${img.naturalWidth} × ${img.naturalHeight}px`);
            }}
          />
        </div>
        <p className="truncate text-xs text-muted-foreground">{path}</p>
        {sizeLabel ? (
          <p className="text-xs tabular-nums text-muted-foreground">{sizeLabel}</p>
        ) : null}
        {statusLabel ? (
          <p className="text-xs text-muted-foreground">{statusLabel}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
