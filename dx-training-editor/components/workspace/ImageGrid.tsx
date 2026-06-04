"use client";

import { ImageOff, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toImageApiUrl } from "@/lib/image-path";

export type ImageGridItem = {
  path: string;
  name: string;
  missing?: boolean;
  statusLabel?: string;
  showInsert?: boolean;
  showDelete?: boolean;
};

type Props = {
  items: ImageGridItem[];
  emptyMessage: string;
  onPreview: (item: ImageGridItem) => void;
  onInsert?: (item: ImageGridItem) => void;
  onDelete?: (item: ImageGridItem) => void;
  className?: string;
};

export function ImageGrid({
  items,
  emptyMessage,
  onPreview,
  onInsert,
  onDelete,
  className,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-center text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.path}
          className={cn(
            "flex flex-col overflow-hidden rounded border border-border bg-card",
            item.missing && "border-destructive/40 bg-destructive/5",
          )}
        >
          <button
            type="button"
            className={cn(
              "relative aspect-square w-full overflow-hidden bg-muted",
              item.missing ? "cursor-default" : "cursor-zoom-in hover:opacity-90",
            )}
            onClick={() => !item.missing && onPreview(item)}
            disabled={item.missing}
            aria-label={item.missing ? item.statusLabel : `${item.name} を拡大表示`}
          >
            {item.missing ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-destructive">
                <ImageOff className="h-5 w-5 shrink-0" />
                <span className="text-[9px] leading-tight">画像が存在しません</span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={toImageApiUrl(item.path)}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            )}
          </button>
          <div className="flex min-h-0 flex-1 flex-col gap-1 p-1.5">
            <p className="truncate text-[10px] font-medium text-foreground" title={item.name}>
              {item.name}
            </p>
            {item.statusLabel ? (
              <p
                className={cn(
                  "text-[9px]",
                  item.missing
                    ? "text-destructive"
                    : item.statusLabel === "未使用"
                      ? "text-muted-foreground"
                      : "text-primary",
                )}
              >
                {item.statusLabel}
              </p>
            ) : null}
            <div className="mt-auto flex gap-1">
              {item.showInsert && onInsert ? (
                <button
                  type="button"
                  onClick={() => onInsert(item)}
                  className="flex flex-1 items-center justify-center gap-0.5 rounded border border-border py-0.5 text-[9px] hover:border-primary hover:text-primary"
                  aria-label="エディタに挿入"
                >
                  <Plus className="h-3 w-3" />
                  挿入
                </button>
              ) : null}
              {item.showDelete && onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  className="flex items-center justify-center rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-destructive hover:text-destructive"
                  aria-label="削除"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
