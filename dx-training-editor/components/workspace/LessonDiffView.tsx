"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  formatLineNumber,
  parseUnifiedDiff,
  type DiffLineKind,
  type ParsedDiffLine,
} from "@/lib/unified-diff-hunks";

type Props = {
  diff: string;
  className?: string;
};

function diffLineClass(kind: DiffLineKind): string {
  switch (kind) {
    case "add":
      return "bg-green-500/10 text-green-700";
    case "remove":
      return "bg-red-500/10 text-red-700";
    case "hunk-header":
      return "text-primary";
    case "file-old":
    case "file-new":
      return "text-muted-foreground";
    default:
      return "";
  }
}

function DiffContentCell({ line }: { line: ParsedDiffLine }) {
  return (
    <div
      className={cn(
        "lesson-diff-content min-w-0 flex-1 py-0",
        diffLineClass(line.kind),
      )}
    >
      {line.text || "\u00A0"}
    </div>
  );
}

export function LessonDiffView({ diff, className }: Props) {
  const lines = useMemo(() => parseUnifiedDiff(diff), [diff]);

  if (!diff.trim()) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center text-sm text-muted-foreground",
          className,
        )}
      >
        差分なし
      </div>
    );
  }

  return (
    <div className={cn("lesson-diff-view h-full overflow-auto", className)}>
      <div className="py-3">
        {lines.map((line) => (
          <div
            key={`line-${line.index}`}
            className="lesson-diff-row flex min-h-[1.375rem]"
          >
            <div className="lesson-diff-line-number shrink-0 tabular-nums">
              {formatLineNumber(line.oldLineNumber)}
            </div>
            <div className="lesson-diff-line-number shrink-0 tabular-nums">
              {formatLineNumber(line.newLineNumber)}
            </div>
            <DiffContentCell line={line} />
          </div>
        ))}
      </div>
    </div>
  );
}
