"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, History, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AgentChatInput,
  renderUserMessageContent,
  type AgentFileOption,
} from "@/components/workspace/AgentChatInput";
import { aiRequestHeaders } from "@/components/workspace/image-manager/image-manager-utils";
import { AI_KEY_ERROR } from "@/components/workspace/image-manager/image-manager-constants";
import {
  buildCreateDraftVariables,
  buildCreateStructureVariables,
} from "@/lib/agent/invoke-context";
import { consumeAnthropicStream } from "@/lib/agent/stream-client";
import {
  addSession,
  DEFAULT_SESSION_TITLE,
  deleteSession,
  deriveSessionTitle,
  downloadSessionMarkdown,
  ensureAgentChatStorage,
  formatMessageTimestamp,
  formatSessionUpdatedAt,
  getActiveSession,
  listSessionsSorted,
  saveAgentChatStorage,
  switchSession,
  updateActiveSession,
  type AgentChatMessage,
  type AgentChatStorage,
} from "@/lib/agent-chat-storage";
import { getLessonBody } from "@/lib/lesson-frontmatter";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import { cn } from "@/lib/utils";
import type { Course, Lesson, Series } from "@/lib/schema";
import type { SkillSummary } from "@/lib/agent/skill-loader";

type Props = {
  series: Series[];
  lesson: Lesson | undefined;
  course: Course | undefined;
  currentLessonPath: string | null;
  onOpenSettings: () => void;
};

function readInitialAgentState(): {
  storage: AgentChatStorage;
  messages: AgentChatMessage[];
  activeSkillId: string | null;
  sessionId: string;
} | null {
  if (typeof window === "undefined") return null;
  const storage = ensureAgentChatStorage();
  const active = getActiveSession(storage);
  if (!active) return null;
  return {
    storage,
    messages: active.messages,
    activeSkillId: active.activeSkillId,
    sessionId: active.id,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AgentChatPane({
  series,
  lesson,
  course,
  currentLessonPath,
  onOpenSettings,
}: Props) {
  const [initialAgentState] = useState(readInitialAgentState);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [chatStorage, setChatStorage] = useState<AgentChatStorage | null>(
    () => initialAgentState?.storage ?? null,
  );
  const [messages, setMessages] = useState<AgentChatMessage[]>(
    () => initialAgentState?.messages ?? [],
  );
  const [input, setInput] = useState("");
  const [activeSkillId, setActiveSkillId] = useState<string | null>(
    () => initialAgentState?.activeSkillId ?? null,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<{
    userMessage: AgentChatMessage;
    history: AgentChatMessage[];
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const stopContextRef = useRef<{
    userMessage: AgentChatMessage;
    assistantId: string;
  } | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const sessionSwitchRef = useRef<string | null>(initialAgentState?.sessionId ?? null);

  useEffect(() => {
    void fetch("/api/agent/skills")
      .then((res) => res.json())
      .then((data: { skills?: SkillSummary[] }) => {
        setSkills(data.skills ?? []);
      })
      .catch(() => {
        setError("スキル一覧の取得に失敗しました");
      });
  }, []);

  useEffect(() => {
    void fetch("/api/agent/config")
      .then((res) => res.json())
      .then((data: { modelLabel?: string }) => {
        setModelLabel(data.modelLabel ?? null);
      })
      .catch(() => {
        setModelLabel(null);
      });
  }, []);

  useEffect(() => {
    if (!historyOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!historyRef.current?.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [historyOpen]);

  const activeSession = useMemo(
    () => (chatStorage ? getActiveSession(chatStorage) : undefined),
    [chatStorage],
  );

  const sortedSessions = useMemo(
    () => (chatStorage ? listSessionsSorted(chatStorage) : []),
    [chatStorage],
  );

  const activeSkill = useMemo(
    () => skills.find((skill) => skill.id === activeSkillId) ?? null,
    [skills, activeSkillId],
  );

  const persistSession = useCallback(
    (
      nextMessages: AgentChatMessage[],
      nextSkillId: string | null,
      titleOverride?: string,
    ) => {
      setChatStorage((prev) => {
        if (!prev) return prev;
        const current = getActiveSession(prev);
        const title =
          titleOverride ??
          (current?.title === DEFAULT_SESSION_TITLE &&
          nextMessages.some((message) => message.role === "user")
            ? deriveSessionTitle(
                nextMessages.find((message) => message.role === "user")?.content ?? "",
              )
            : current?.title ?? DEFAULT_SESSION_TITLE);
        const next = updateActiveSession(prev, {
          messages: nextMessages,
          activeSkillId: nextSkillId,
          title,
        });
        saveAgentChatStorage(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!chatStorage || sessionSwitchRef.current === null) return;
    const timer = window.setTimeout(() => {
      persistSession(messages, activeSkillId);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [messages, activeSkillId, chatStorage, persistSession]);

  const loadContentFiles = useCallback(async () => {
    const params = currentLessonPath
      ? `?current=${encodeURIComponent(currentLessonPath)}`
      : "";
    const res = await fetch(`/api/agent/files${params}`);
    const data = (await res.json()) as { files?: AgentFileOption[] };
    return data.files ?? [];
  }, [currentLessonPath]);

  const buildVariables = useCallback(
    (skillId: string): Record<string, string> | { error: string } => {
      if (skillId === "create-structure") {
        return buildCreateStructureVariables(series);
      }
      if (skillId === "create-draft") {
        if (!lesson) {
          return { error: "create-draft スキルはレッスン選択が必要です" };
        }
        return buildCreateDraftVariables({
          lesson,
          lessonBody: getLessonBody(lesson),
          courseMeta: {
            name: course?.name ?? lesson.course,
            target_audience: course?.target_audience ?? "",
            prerequisites: course?.prerequisites ?? [],
            next_courses: course?.next_courses ?? [],
          },
        });
      }
      return {};
    },
    [series, lesson, course],
  );

  const handleStop = useCallback(() => {
    const stopContext = stopContextRef.current;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStreamingAssistantId(null);
    setRetryPayload(null);
    setError(null);

    if (stopContext) {
      setMessages((prev) =>
        prev.filter(
          (message) =>
            message.id !== stopContext.userMessage.id &&
            message.id !== stopContext.assistantId,
        ),
      );
      setInput(stopContext.userMessage.content);
      stopContextRef.current = null;
    }
  }, []);

  const invokeSkill = useCallback(
    async (options: {
      userMessage: AgentChatMessage;
      history: AgentChatMessage[];
      skillId: string;
    }) => {
      const variablesResult = buildVariables(options.skillId);
      if ("error" in variablesResult) {
        setError(variablesResult.error);
        return;
      }

      const assistantId = createMessageId();

      setMessages((prev) => [
        ...prev,
        options.userMessage,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ]);
      setIsStreaming(true);
      setStreamingAssistantId(assistantId);
      setError(null);
      setRetryPayload({
        userMessage: options.userMessage,
        history: options.history,
      });
      stopContextRef.current = {
        userMessage: options.userMessage,
        assistantId,
      };

      const controller = new AbortController();
      abortRef.current = controller;

      const settings = loadWorkspaceSettings();
      const payload = {
        skillId: options.skillId,
        variables: variablesResult,
        messages: [...options.history, options.userMessage].map((message) => ({
          role: message.role,
          content: message.content,
        })),
      };

      try {
        const res = await fetch("/api/agent/invoke", {
          method: "POST",
          headers: aiRequestHeaders(settings),
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          let message = "スキル実行に失敗しました";
          try {
            const data = (await res.json()) as { error?: string };
            message = data.error ?? message;
          } catch {
            // ignore
          }
          if (res.status === 401) {
            message = AI_KEY_ERROR;
          }
          throw new Error(message);
        }

        await consumeAnthropicStream(
          res,
          (delta) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + delta }
                  : message,
              ),
            );
          },
          controller.signal,
        );
        stopContextRef.current = null;
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "スキル実行に失敗しました";
        setError(message);
        setMessages((prev) => prev.filter((message) => message.id !== assistantId));
        stopContextRef.current = null;
        if (message === AI_KEY_ERROR) {
          onOpenSettings();
        }
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsStreaming(false);
        setStreamingAssistantId(null);
      }
    },
    [buildVariables, onOpenSettings],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    if (!activeSkillId) {
      setError("スキルを選択してください。入力欄で / を入力してスキルを選べます。");
      return;
    }

    if (activeSkillId === "create-draft" && !lesson) {
      setError("create-draft スキルはレッスン選択が必要です");
      return;
    }

    const userMessage: AgentChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setInput("");
    await invokeSkill({
      userMessage,
      history: messages,
      skillId: activeSkillId,
    });
  }, [activeSkillId, input, invokeSkill, isStreaming, lesson, messages]);

  const handleRetry = useCallback(async () => {
    if (!retryPayload || !activeSkillId || isStreaming) return;
    await invokeSkill({
      userMessage: retryPayload.userMessage,
      history: retryPayload.history,
      skillId: activeSkillId,
    });
  }, [activeSkillId, invokeSkill, isStreaming, retryPayload]);

  const applySessionState = useCallback((sessionId: string, storage: AgentChatStorage) => {
    const session = storage.sessions.find((item) => item.id === sessionId);
    if (!session) return;
    sessionSwitchRef.current = session.id;
    setMessages(session.messages);
    setActiveSkillId(session.activeSkillId);
    setInput("");
    setError(null);
    setRetryPayload(null);
  }, []);

  const handleSwitchSession = useCallback(
    (sessionId: string) => {
      if (!chatStorage || sessionId === chatStorage.activeSessionId) {
        setHistoryOpen(false);
        return;
      }
      if (input.trim() && !window.confirm("入力中の内容は失われます。切り替えますか？")) {
        return;
      }
      persistSession(messages, activeSkillId);
      const next = switchSession(chatStorage, sessionId);
      saveAgentChatStorage(next);
      setChatStorage(next);
      applySessionState(sessionId, next);
      setHistoryOpen(false);
    },
    [activeSkillId, applySessionState, chatStorage, input, messages, persistSession],
  );

  const handleNewSession = useCallback(() => {
    if (!chatStorage) return;
    if (input.trim() && !window.confirm("入力中の内容は失われます。新規会話を開始しますか？")) {
      return;
    }
    persistSession(messages, activeSkillId);
    const next = addSession(chatStorage);
    saveAgentChatStorage(next);
    setChatStorage(next);
    applySessionState(next.activeSessionId, next);
    setHistoryOpen(false);
  }, [activeSkillId, applySessionState, chatStorage, input, messages, persistSession]);

  const handleDeleteCurrentSession = useCallback(() => {
    if (!chatStorage) return;
    const next = deleteSession(chatStorage, chatStorage.activeSessionId);
    saveAgentChatStorage(next);
    setChatStorage(next);
    applySessionState(next.activeSessionId, next);
    setClearDialogOpen(false);
  }, [applySessionState, chatStorage]);

  const handleBuiltinCommand = useCallback(
    (command: "clear" | "export") => {
      if (command === "clear") {
        setClearDialogOpen(true);
        return;
      }
      if (activeSession) {
        downloadSessionMarkdown({
          ...activeSession,
          messages,
          activeSkillId,
        });
      }
    },
    [activeSession, activeSkillId, messages],
  );

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId(null), 1500);
    } catch {
      setError("クリップボードへのコピーに失敗しました");
    }
  }, []);

  const sessionTitle = activeSession?.title ?? DEFAULT_SESSION_TITLE;

  return (
    <div className="agent-chat-pane flex h-full min-h-0 flex-col">
      <div className="relative z-10 shrink-0 px-12 pt-3 pb-2">
        <div className="flex items-center gap-2">
        <div ref={historyRef} className="relative">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1 border-0 bg-muted text-foreground hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80"
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <History className="size-3" />
            履歴
            <ChevronDown className="size-3" />
          </Button>
          {historyOpen ? (
            <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-72 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              {sortedSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted/60",
                    session.id === chatStorage?.activeSessionId && "bg-muted",
                  )}
                  onClick={() => handleSwitchSession(session.id)}
                >
                  <span className="font-medium text-foreground">{session.title}</span>
                  <span className="text-muted-foreground">
                    {session.activeSkillId ?? "スキル未選択"} · {session.messages.length} 件 ·{" "}
                    {formatSessionUpdatedAt(session.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {sessionTitle}
        </span>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1 border-0 bg-muted text-foreground hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80"
          onClick={handleNewSession}
        >
          <Plus className="size-3" />
          新規
        </Button>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-5 h-5 bg-gradient-to-b from-[var(--agent-chat-pane-bg)] to-transparent"
        />
      </div>

      <div className="workspace-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="px-12 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
            / でスキルを選択し、メッセージを送信してください
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {messages.map((message) => {
              const isStreamingMessage =
                isStreaming && message.id === streamingAssistantId;
              const showActions =
                message.role === "assistant" &&
                !isStreamingMessage &&
                Boolean(message.content);
              const copied = copiedMessageId === message.id;

              if (message.role === "user") {
                return (
                  <div key={message.id} className="flex w-full justify-end">
                    <div className="max-w-[min(70%,28rem)] rounded-2xl bg-muted px-3 py-2 text-sm text-foreground">
                      <div className="whitespace-pre-wrap break-words">
                        {renderUserMessageContent(message.content)}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className="flex w-full flex-col gap-2 text-sm">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm">
                    {message.content || "..."}
                  </pre>
                  {showActions ? (
                    <div className="flex items-center gap-2">
                      <WorkspaceTooltip
                        label={copied ? "コピー済み" : "コピー"}
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={copied ? "コピー済み" : "コピー"}
                            onClick={() => void handleCopy(message.id, message.content)}
                          >
                            {copied ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTimestamp(message)}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-2 bg-destructive/10 px-12 py-2 text-xs text-destructive">
          <span>{error}</span>
          {retryPayload ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void handleRetry()}>
              <RotateCcw className="size-3" />
              再送
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="relative z-10 shrink-0 px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-5 h-5 bg-gradient-to-t from-[var(--agent-chat-pane-bg)] to-transparent"
        />
        <AgentChatInput
        value={input}
        onChange={setInput}
        onSend={() => void handleSend()}
        onStop={handleStop}
        disabled={false}
        isLoading={isStreaming}
        modelLabel={modelLabel}
        skills={skills}
        activeSkillId={activeSkillId}
        activeSkillName={activeSkill?.name ?? null}
        onActiveSkillChange={setActiveSkillId}
        onLoadContentFiles={loadContentFiles}
        onBuiltinCommand={handleBuiltinCommand}
        createDraftDisabled={!lesson}
        />
      </div>

      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>会話を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              現在のセッションは履歴から削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCurrentSession}>
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
