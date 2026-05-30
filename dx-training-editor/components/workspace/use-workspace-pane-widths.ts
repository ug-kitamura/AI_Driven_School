"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  clampPaneWidth,
  loadPaneWidths,
  PANE_RESIZE_INVERT_DELTA,
  PANE_WIDTH_DEFAULTS,
  savePaneWidths,
  type WorkspacePaneWidths,
} from "@/components/workspace/pane-layout";

type DragSession = {
  pane: keyof WorkspacePaneWidths;
  startX: number;
  startWidth: number;
};

export function useWorkspacePaneWidths() {
  const [paneWidths, setPaneWidths] =
    useState<WorkspacePaneWidths>(PANE_WIDTH_DEFAULTS);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<DragSession | null>(null);

  useLayoutEffect(() => {
    setPaneWidths(loadPaneWidths());
  }, []);

  const beginResize = useCallback(
    (pane: keyof WorkspacePaneWidths, clientX: number) => {
      setIsResizing(true);
      setPaneWidths((prev) => {
        dragRef.current = {
          pane,
          startX: clientX,
          startWidth: prev[pane],
        };
        return prev;
      });
    },
    [],
  );

  const moveResize = useCallback((clientX: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = clientX - drag.startX;
    const signed = PANE_RESIZE_INVERT_DELTA[drag.pane] ? -delta : delta;
    const nextWidth = clampPaneWidth(drag.pane, drag.startWidth + signed);
    setPaneWidths((prev) => {
      if (prev[drag.pane] === nextWidth) return prev;
      return { ...prev, [drag.pane]: nextWidth };
    });
  }, []);

  const endResize = useCallback(() => {
    dragRef.current = null;
    setIsResizing(false);
    setPaneWidths((prev) => {
      savePaneWidths(prev);
      return prev;
    });
  }, []);

  const resizeHandleProps = useCallback(
    (pane: keyof WorkspacePaneWidths) => ({
      onResizeStart: (clientX: number) => beginResize(pane, clientX),
      onResize: moveResize,
      onResizeEnd: endResize,
    }),
    [beginResize, moveResize, endResize],
  );

  return {
    paneWidths,
    isResizing,
    resizeHandleProps,
  };
}
