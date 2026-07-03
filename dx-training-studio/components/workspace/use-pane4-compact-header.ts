"use client";

import { useEffect, useState } from "react";

/** Pane 4 ヘッダー左側をアイコンのみにする実幅しきい値 */
export const PANE4_COMPACT_HEADER_WIDTH = 480;

export function usePane4CompactHeader(containerRef: React.RefObject<HTMLElement | null>) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setCompact(el.clientWidth < PANE4_COMPACT_HEADER_WIDTH);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return compact;
}
