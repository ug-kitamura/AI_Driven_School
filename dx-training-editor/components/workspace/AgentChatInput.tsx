"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SkillSummary } from "@/lib/agent/skill-loader";

export type AgentFileOption = {
  path: string;
  name: string;
};

type SuggestionKind = "skill" | "file";

type SuggestionState = {
  kind: SuggestionKind;
  query: string;
  start: number;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  skills: SkillSummary[];
  activeSkillId: string | null;
  activeSkillName: string | null;
  onActiveSkillChange: (skillId: string | null) => void;
  onLoadContentFiles: () => Promise<AgentFileOption[]>;
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
  disabled = false,
  isLoading = false,
  skills,
  activeSkillId,
  activeSkillName,
  onActiveSkillChange,
  onLoadContentFiles,
  createDraftDisabled = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestion, setSuggestion] = useState<SuggestionState | null>(null);
  const [contentFiles, setContentFiles] = useState<AgentFileOption[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filteredSkills = useMemo(() => {
    const query = suggestion?.kind === "skill" ? suggestion.query.toLowerCase() : "";
    return skills.filter((skill) => {
      if (query && !skill.id.toLowerCase().startsWith(query)) return false;
      if (skill.id === "create-draft" && createDraftDisabled) return false;
      return true;
    });
  }, [skills, suggestion, createDraftDisabled]);

  const visibleFileOptions = useMemo(() => {
    if (suggestion?.kind !== "file") return [];
    const query = suggestion.query.toLowerCase();
    if (!query) return contentFiles;
    return contentFiles.filter((file) => file.path.toLowerCase().includes(query));
  }, [contentFiles, suggestion]);

  const visibleItems =
    suggestion?.kind === "skill"
      ? filteredSkills.map((skill) => ({
          key: skill.id,
          primary: skill.name,
          secondary: skill.description,
          disabled: false,
        }))
      : visibleFileOptions.map((file) => ({
          key: file.path,
          primary: file.name,
          secondary: file.path,
          disabled: false,
        }));

  useEffect(() => {
    setHighlightIndex(0);
  }, [suggestion?.kind, suggestion?.query, visibleItems.length]);

  useEffect(() => {
    if (!value) setSuggestion(null);
  }, [value]);

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
      : "一致するスキルがありません";

  const updateSuggestionFromCursor = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setSuggestion(null);
      return;
    }
    const cursor = textarea.selectionStart ?? textarea.value.length;
    setSuggestion(detectSuggestion(textarea.value, cursor));
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    const cursor = event.target.selectionStart ?? next.length;
    onChange(next);
    setSuggestion(detectSuggestion(next, cursor));
  };

  const applySkillSelection = useCallback(
    (skillId: string) => {
      const textarea = textareaRef.current;
      if (!textarea || !suggestion || suggestion.kind !== "skill") return;
      const before = value.slice(0, suggestion.start);
      const after = value.slice(textarea.selectionStart);
      onChange(`${before}${after}`.replace(/^\n/, ""));
      onActiveSkillChange(skillId);
      setSuggestion(null);
      requestAnimationFrame(() => textarea.focus());
    },
    [onActiveSkillChange, onChange, suggestion, value],
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
          const item = visibleItems[highlightIndex];
          if (suggestion.kind === "skill") {
            applySkillSelection(item.key);
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
    <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-card p-3">
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
                  key={item.key}
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2 text-left text-xs",
                    index === highlightIndex ? "bg-muted" : "hover:bg-muted/60",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (suggestion.kind === "skill") {
                      applySkillSelection(item.key);
                    } else {
                      applyFileSelection(item.key);
                    }
                  }}
                >
                  <span className="font-medium text-foreground">{item.primary}</span>
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
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {isLoading ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            生成中...
          </span>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={disabled || isLoading || !value.trim()}
          onClick={onSend}
        >
          <Send className="size-3" />
          送信
        </Button>
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
          className="mx-0.5 inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
        >
          {fileName}
        </span>
      );
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}
