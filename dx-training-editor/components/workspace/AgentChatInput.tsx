"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SkillSummary } from "@/lib/agent/skill-loader";
import {
  filterBuiltinCommands,
  filterContentFiles,
  filterSkills,
  type AgentBuiltinCommand,
  type AgentFileOption,
} from "@/lib/agent-chat-suggestions";

export type { AgentFileOption };

type SuggestionKind = "skill" | "file";

type SuggestionState = {
  kind: SuggestionKind;
  query: string;
  start: number;
};

type SuggestionItem = {
  kind: "command" | "skill" | "file";
  key: string;
  primary: string;
  secondary: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  modelLabel?: string | null;
  skills: SkillSummary[];
  activeSkillId: string | null;
  activeSkillName: string | null;
  onActiveSkillChange: (skillId: string | null) => void;
  onLoadContentFiles: () => Promise<AgentFileOption[]>;
  onBuiltinCommand?: (command: AgentBuiltinCommand["id"]) => void;
  createDraftDisabled?: boolean;
};

function detectSuggestion(value: string, cursor: number): SuggestionState | null {
  const beforeCursor = value.slice(0, cursor);
  const atMatch = /@([^\s@]*)$/.exec(beforeCursor);
  if (atMatch) {
    const query = atMatch[1] ?? "";
    return {
      kind: "file",
      query,
      start: beforeCursor.length - query.length - 1,
    };
  }

  const slashMatch = /(^|\n)\/([^\s/]*)$/.exec(beforeCursor);
  if (slashMatch) {
    const query = slashMatch[2] ?? "";
    return {
      kind: "skill",
      query,
      start: beforeCursor.length - query.length - 1,
    };
  }

  return null;
}

export function AgentChatInput({
  value,
  onChange,
  onSend,
  onStop,
  disabled = false,
  isLoading = false,
  modelLabel = null,
  skills,
  activeSkillId,
  activeSkillName,
  onActiveSkillChange,
  onLoadContentFiles,
  onBuiltinCommand,
  createDraftDisabled = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [contentFiles, setContentFiles] = useState<AgentFileOption[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filteredSkills = useMemo(() => {
    const query = suggestion?.kind === "skill" ? suggestion.query : "";
    return filterSkills(skills, query, createDraftDisabled);
  }, [skills, suggestion, createDraftDisabled]);

  const filteredCommands = useMemo(() => {
    if (suggestion?.kind !== "skill") return [];
    return filterBuiltinCommands(suggestion.query);
  }, [suggestion]);

  const visibleFileOptions = useMemo(() => {
    if (suggestion?.kind !== "file") return [];
    return filterContentFiles(contentFiles, suggestion.query);
  }, [contentFiles, suggestion]);

  const visibleItems: SuggestionItem[] = useMemo(() => {
    if (suggestion?.kind === "skill") {
      const commandItems = filteredCommands.map((command) => ({
        kind: "command" as const,
        key: command.id,
        primary: command.name,
        secondary: command.description,
      }));
      const skillItems = filteredSkills.map((skill) => ({
        kind: "skill" as const,
        key: skill.id,
        primary: skill.name,
        secondary: skill.description,
      }));
      return [...commandItems, ...skillItems];
    }
    return visibleFileOptions.map((file) => ({
      kind: "file" as const,
      key: file.path,
      primary: file.name,
      secondary: file.path,
    }));
  }, [filteredCommands, filteredSkills, suggestion?.kind, visibleFileOptions]);

  useEffect(() => {
    if (suggestion?.kind !== "file") return;

    let cancelled = false;
    setFilesLoading(true);
    void onLoadContentFiles()
      .then((files) => {
        if (!cancelled) setContentFiles(files);
      })
      .finally(() => {
        if (!cancelled) setFilesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [suggestion?.kind, onLoadContentFiles]);

  const suggestionEmptyMessage =
    suggestion?.kind === "file"
      ? filesLoading
        ? "ファイル一覧を読み込み中..."
        : suggestion.query
          ? "一致するファイルがありません"
          : "contents/ 内に .md ファイルがありません"
      : "一致するスキルまたはコマンドがありません";

  const updateSuggestionFromCursor = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setSuggestion(null);
      return;
    }
    const cursor = textarea.selectionStart ?? textarea.value.length;
    setSuggestion(detectSuggestion(textarea.value, cursor));
    setHighlightIndex(0);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    const cursor = event.target.selectionStart ?? next.length;
    onChange(next);
    setSuggestion(next ? detectSuggestion(next, cursor) : null);
    setHighlightIndex(0);
  };

  const clearSlashToken = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !suggestion || suggestion.kind !== "skill") return;
    const before = value.slice(0, suggestion.start);
    const after = value.slice(textarea.selectionStart);
    onChange(`${before}${after}`.replace(/^\n/, ""));
    setSuggestion(null);
    requestAnimationFrame(() => textarea.focus());
  }, [onChange, suggestion, value]);

  const applySkillSelection = useCallback(
    (skillId: string) => {
      clearSlashToken();
      onActiveSkillChange(skillId);
    },
    [clearSlashToken, onActiveSkillChange],
  );

  const applyCommandSelection = useCallback(
    (commandId: AgentBuiltinCommand["id"]) => {
      clearSlashToken();
      onBuiltinCommand?.(commandId);
    },
    [clearSlashToken, onBuiltinCommand],
  );

  const applyFileSelection = useCallback(
    (filePath: string) => {
      const textarea = textareaRef.current;
      if (!textarea || !suggestion || suggestion.kind !== "file") return;
      const token = `@${filePath}`;
      const before = value.slice(0, suggestion.start);
      const after = value.slice(textarea.selectionStart);
      const next = `${before}${token} ${after}`;
      onChange(next);
      setSuggestion(null);
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = before.length + token.length + 1;
        textarea.setSelectionRange(pos, pos);
      });
    },
    [onChange, suggestion, value],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestion) {
      if (visibleItems.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setHighlightIndex((index) => (index + 1) % visibleItems.length);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setHighlightIndex(
            (index) => (index - 1 + visibleItems.length) % visibleItems.length,
          );
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const item = visibleItems[highlightIndex % visibleItems.length];
          if (item.kind === "skill") {
            applySkillSelection(item.key);
          } else if (item.kind === "command") {
            applyCommandSelection(item.key as AgentBuiltinCommand["id"]);
          } else {
            applyFileSelection(item.key);
          }
          return;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSuggestion(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!disabled && !isLoading) onSend();
    }
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 py-3">
      {activeSkillId ? (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {activeSkillName ?? activeSkillId}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="スキル選択を解除"
            onClick={() => onActiveSkillChange(null)}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}

      <div className="relative">
        {suggestion ? (
          <div className="absolute inset-x-0 bottom-full z-20 mb-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
            {filesLoading || visibleItems.length > 0 ? (
              filesLoading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {suggestionEmptyMessage}
                </div>
              ) : (
                visibleItems.map((item, index) => (
                  <button
                    key={`${item.kind}-${item.key}`}
                    type="button"
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs",
                      index === highlightIndex ? "bg-muted" : "hover:bg-muted/60",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (item.kind === "skill") {
                        applySkillSelection(item.key);
                      } else if (item.kind === "command") {
                        applyCommandSelection(item.key as AgentBuiltinCommand["id"]);
                      } else {
                        applyFileSelection(item.key);
                      }
                    }}
                  >
                    <span className="font-medium text-foreground">
                      {item.kind === "command" ? `/${item.key}` : item.primary}
                    </span>
                    <span className="truncate text-muted-foreground">{item.secondary}</span>
                  </button>
                ))
              )
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {suggestionEmptyMessage}
              </div>
            )}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInputChange}
          onClick={updateSuggestionFromCursor}
          onKeyUp={updateSuggestionFromCursor}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="メッセージを入力（/ でスキル、@ でファイル参照）"
          disabled={disabled || isLoading}
          className="w-full resize-y rounded-lg border border-border bg-white px-3 pb-10 pt-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary dark:bg-muted"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-2 pb-2">
          <span className="truncate text-[10px] text-muted-foreground">
            {modelLabel ?? ""}
          </span>
          <div className="pointer-events-auto flex items-center gap-1">
            {isLoading ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                aria-label="生成を停止"
                onClick={onStop}
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              className="size-8 shrink-0 rounded-full"
              disabled={disabled || isLoading || !value.trim()}
              aria-label="送信"
              onClick={onSend}
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function renderUserMessageContent(content: string) {
  const parts = content.split(/(@contents\/[^\s@]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("@contents/")) {
      const fileName = part.split("/").pop() ?? part;
      return (
        <span
          key={`${part}-${index}`}
          className="mx-0.5 inline-flex rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
        >
          {fileName}
        </span>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}
