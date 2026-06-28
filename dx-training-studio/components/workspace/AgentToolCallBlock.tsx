"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentToolEvent } from "@/lib/agent/llm/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Props = {
  events: AgentToolEvent[];
  className?: string;
};

function pairToolEvents(events: AgentToolEvent[]): Array<{
  start?: AgentToolEvent;
  end?: AgentToolEvent;
}> {
  const starts = events.filter((event) => event.phase === "start");
  const ends = events.filter((event) => event.phase === "end");
  const paired = ends.map((end) => ({
    start: starts.find((start) => start.toolUseId === end.toolUseId),
    end,
  }));
  const unmatchedStarts = starts.filter(
    (start) => !ends.some((end) => end.toolUseId === start.toolUseId),
  );
  return [...paired, ...unmatchedStarts.map((start) => ({ start }))];
}

export function AgentToolCallBlock({ events, className }: Props) {
  const [open, setOpen] = useState(false);
  const pairs = pairToolEvents(events);
  if (pairs.length === 0) return null;

  const summary = pairs
    .map((pair) => pair.end?.display ?? pair.start?.display ?? pair.end?.name ?? "")
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto justify-start gap-1 px-0 py-0 text-xs text-muted-foreground hover:bg-transparent"
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
        <span>{summary}</span>
      </Button>
      {open ? (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          {pairs.map((pair, index) => {
            const end = pair.end;
            const start = pair.start;
            const query =
              start?.input && typeof start.input.query === "string"
                ? start.input.query
                : undefined;
            return (
              <div key={end?.toolUseId ?? start?.toolUseId ?? index} className="flex flex-col gap-0.5">
                <span>{end?.display ?? start?.display}</span>
                {query ? <span>query: {query}</span> : null}
                {end?.summary ? <span>result: {end.summary}</span> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
