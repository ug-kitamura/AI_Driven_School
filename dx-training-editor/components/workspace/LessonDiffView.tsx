"use client";

import { cn } from "@/lib/utils";

type Props = {
  diff: string;
  className?: string;
};

export function LessonDiffView({ diff, className }: Props) {
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
    <pre
      className={cn(
        "h-full overflow-auto whitespace-pre px-4 py-3 font-mono text-xs text-foreground",
        className,
      )}
    >
      {diff.split("\n").map((line, i) => (
        <div
          key={i}
          className={cn(
            "leading-relaxed",
            line.startsWith("+") && !line.startsWith("+++")
              ? "bg-green-500/10 text-green-700"
              : line.startsWith("-") && !line.startsWith("---")
                ? "bg-red-500/10 text-red-700"
                : line.startsWith("@@")
                  ? "text-primary"
                  : line.startsWith("+++") || line.startsWith("---")
                    ? "text-muted-foreground"
                    : "",
          )}
        >
          {line || "\u00A0"}
        </div>
      ))}
    </pre>
  );
}
