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

type CompactItem = {
  i?: number;
  title?: string;
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

function parseToolResult(resultJson?: string): Record<string, unknown> | null {
  if (!resultJson) return null;
  try {
    const parsed: unknown = JSON.parse(resultJson);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readCompactItems(result: Record<string, unknown> | null): CompactItem[] {
  if (!result || !Array.isArray(result.items)) return [];
  return result.items.filter(
    (item): item is CompactItem =>
      typeof item === "object" && item !== null && "title" in item,
  );
}

function ToolEventDetails({
  start,
  end,
}: {
  start?: AgentToolEvent;
  end?: AgentToolEvent;
}) {
  const toolName = end?.name ?? start?.name;
  const result = parseToolResult(end?.result);
  const error = typeof result?.error === "string" ? result.error : undefined;
  const query =
    start?.input && typeof start.input.query === "string" ? start.input.query : undefined;
  const items = readCompactItems(result);

  return (
    <div className="flex flex-col gap-0.5">
      <span>{end?.display ?? start?.display}</span>
      {query ? <span>query: {query}</span> : null}
      {toolName === "search_company_context" && items.length > 0 ? (
        <ul className="flex flex-col gap-0.5 pl-2">
          {items.map((item) => (
            <li key={`${item.i ?? item.title}`}>
              {item.i != null ? `${item.i}. ` : ""}
              {item.title ?? ""}
            </li>
          ))}
        </ul>
      ) : null}
      {toolName === "select_company_context" ? (
        <>
          {items.length > 0 ? (
            <ul className="flex flex-col gap-0.5 pl-2">
              {items.map((item) => (
                <li key={`${item.i ?? item.title}`}>
                  {item.i != null ? `${item.i}. ` : ""}
                  {item.title ?? ""}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {error ? <span>error: {error}</span> : null}
      {!error && typeof result?.warning === "string" ? (
        <span>warning: {result.warning}</span>
      ) : null}
      {!error && end?.tags && end.tags.length > 0 ? (
        <span>tags: {end.tags.join(", ")}</span>
      ) : null}
      {!error && end?.summary ? <span>result: {end.summary}</span> : null}
    </div>
  );
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
          {pairs.map((pair, index) => (
            <ToolEventDetails
              key={pair.end?.toolUseId ?? pair.start?.toolUseId ?? index}
              start={pair.start}
              end={pair.end}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
