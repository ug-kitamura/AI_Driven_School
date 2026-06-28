"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, FilePen, History, Plus, RotateCcw, Trash2 } from "lucide-react";
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
  type AgentFileOption,
} from "@/components/workspace/AgentChatInput";
import { AgentChatMessageContent } from "@/components/workspace/AgentChatMessageContent";
import { aiRequestHeaders } from "@/components/workspace/image-manager/image-manager-utils";
import { AI_KEY_ERROR } from "@/components/workspace/image-manager/image-manager-constants";
import {
  buildCreateDraftVariables,
  buildCreateStructureVariables,
} from "@/lib/agent/invoke-context";
import {
  resolveSearchQueryRequest,
  shouldApproveSearchResults,
} from "@/lib/context-draft-selection";
import { extractMarkdownBlock } from "@/lib/extract-markdown-block";
import type { ContextItem } from "@/lib/context-db/types";
import { withContextMode } from "@/lib/context-api-client";
import { consumeAnthropicStream } from "@/lib/agent/stream-client";
import {
  addSession,
  DEFAULT_SESSION_TITLE,
  deleteSession,
  deriveSessionTitle,
  downloadSessionMarkdown,
  formatMessageTimestamp,
  formatSessionUpdatedAt,
  getActiveSession,
  listSessionsSorted,
  switchSession,
  updateActiveSession,
  type AgentChatMessage,
  type AgentChatStorage,
  type CreateDraftContextSnapshot,
} from "@/lib/agent-chat-storage";
import { loadLessonSession, saveLessonSession } from "@/lib/agent-session-client";
import type { AgentChatController } from "@/lib/agent-chat-controller";
import { resolveModelLabel } from "@/lib/agent/model-labels";
import { getLessonBody, normalizeDraftMarkdownForLesson } from "@/lib/lesson-frontmatter";
import { collectAllLessonTags } from "@/lib/lesson-tags";
import {
  loadWorkspaceSettings,
  WORKSPACE_SETTINGS_CHANGED_EVENT,
} from "@/lib/workspace-settings";
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
  onOverwriteEditor?: (markdown: string) => void;
  agentChatControllerRef?: React.MutableRefObject<AgentChatController | null>;
  className?: string;
  /** Agent タブ表示中のみ Markdown をレンダリングする */
  richMarkdown?: boolean;
};

type CreateDraftContextState = {
  contextItemsJson: string;
  searchResults: ContextItem[];
  searchPerformed: boolean;
  lastSearchQuery: string | null;
  searchResultsApproved: boolean;
};

function emptyCreateDraftContextState(): CreateDraftContextState {
  return {
    contextItemsJson: "[]",
    searchResults: [],
    searchPerformed: false,
    lastSearchQuery: null,
    searchResultsApproved: false,
  };
}

function snapshotCreateDraftContext(
  state: CreateDraftContextState,
): CreateDraftContextSnapshot {
  return {
    contextItemsJson: state.contextItemsJson,
    searchResults: state.searchResults,
    searchPerformed: state.searchPerformed,
    lastSearchQuery: state.lastSearchQuery,
    searchResultsApproved: state.searchResultsApproved,
  };
}

function restoreCreateDraftContext(
  snapshot: CreateDraftContextSnapshot | null | undefined,
): CreateDraftContextState {
  if (!snapshot) return emptyCreateDraftContextState();

  const searchResults = snapshot.searchResults ?? [];
  const contextItemsJson =
    searchResults.length > 0
      ? JSON.stringify(searchResults, null, 2)
      : snapshot.contextItemsJson;

  return {
    contextItemsJson,
    searchResults,
    searchPerformed: snapshot.searchPerformed,
    lastSearchQuery: snapshot.lastSearchQuery ?? null,
    searchResultsApproved: snapshot.searchResultsApproved ?? false,
  };
}

function computeSessionFingerprint(
  nextMessages: AgentChatMessage[],
  nextSkillId: string | null,
  draftState: CreateDraftContextState,
): string {
  return JSON.stringify({
    messages: nextMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    })),
    activeSkillId: nextSkillId,
    createDraftContext:
      nextSkillId === "create-draft"
        ? snapshotCreateDraftContext(draftState)
        : null,
  });
}

const CONTINUE_USER_MESSAGE = "つづきよろしく";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readModelLabelFromSettings(): string {
  return resolveModelLabel(loadWorkspaceSettings().aiModel);
}

export function AgentChatPane({
  series,
  lesson,
  course,
  currentLessonPath,
  onOpenSettings,
  onOverwriteEditor,
  agentChatControllerRef,
  className,
  richMarkdown = true,
}: Props) {
  const lessonId = lesson?.id;
  const [chatStorage, setChatStorage] = useState<AgentChatStorage | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteSessionTargetId, setDeleteSessionTargetId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<{
    userMessage: AgentChatMessage;
    history: AgentChatMessage[];
  } | null>(null);

  const [overwriteTarget, setOverwriteTarget] = useState<{
    messageId: string;
    content: string;
  } | null>(null);

  const [pendingContinueAssistantId, setPendingContinueAssistantId] = useState<
    string | null
  >(null);

  const abortRef = useRef<AbortController | null>(null);
  const createDraftContextRef = useRef<CreateDraftContextState>(
    emptyCreateDraftContextState(),
  );
  const stopContextRef = useRef<{
    userMessage: AgentChatMessage;
    assistantId: string;
  } | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const sessionSwitchRef = useRef<string | null>(null);
  const currentLessonIdRef = useRef<string | null>(null);
  const chatStorageRef = useRef<AgentChatStorage | null>(null);
  const messagesRef = useRef<AgentChatMessage[]>([]);
  const activeSkillIdRef = useRef<string | null>(null);
  const lastPersistedFingerprintRef = useRef("");
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [skills, setSkills] = useState<SkillSummary[]>([]);

  useEffect(() => {
    chatStorageRef.current = chatStorage;
  }, [chatStorage]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeSkillIdRef.current = activeSkillId;
  }, [activeSkillId]);

  const buildStorageSnapshot = useCallback((): AgentChatStorage | null => {
    const storage = chatStorageRef.current;
    if (!storage) return null;
    return updateActiveSession(storage, {
      messages: messagesRef.current,
      activeSkillId: activeSkillIdRef.current,
      createDraftContext:
        activeSkillIdRef.current === "create-draft"
          ? snapshotCreateDraftContext(createDraftContextRef.current)
          : null,
    });
  }, []);

  const flushSessionToStorage = useCallback(async (lessonId: string) => {
    const snapshot = buildStorageSnapshot();
    if (!snapshot) return;
    await saveLessonSession(lessonId, snapshot);
  }, [buildStorageSnapshot]);

  const scheduleDebouncedPersist = useCallback(() => {
    if (!lessonId || sessionSwitchRef.current === null) return;

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      const targetLessonId = currentLessonIdRef.current;
      if (!targetLessonId) return;

      const fingerprint = computeSessionFingerprint(
        messagesRef.current,
        activeSkillIdRef.current,
        createDraftContextRef.current,
      );
      if (fingerprint === lastPersistedFingerprintRef.current) return;

      void flushSessionToStorage(targetLessonId).then(() => {
        lastPersistedFingerprintRef.current = fingerprint;
      });
    }, 800);
  }, [flushSessionToStorage, lessonId]);

  const resetCreateDraftContext = useCallback(() => {
    createDraftContextRef.current = emptyCreateDraftContextState();
  }, []);

  const scrollChatToBottom = useCallback(() => {
    const element = chatScrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, []);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollChatToBottom();
  }, [messages, isStreaming, streamingAssistantId, scrollChatToBottom]);

  useEffect(() => {
    resetCreateDraftContext();
  }, [activeSkillId, resetCreateDraftContext]);

  useEffect(() => {
    if (!richMarkdown) return;
    void fetch("/api/agent/skills")
      .then((res) => res.json())
      .then((data: { skills?: SkillSummary[] }) => {
        setSkills(data.skills ?? []);
      })
      .catch(() => {
        setError("スキル一覧の取得に失敗しました");
      });
  }, [richMarkdown]);

  useEffect(() => {
    const syncModelLabel = () => {
      setModelLabel(readModelLabelFromSettings());
    };
    syncModelLabel();
    window.addEventListener(WORKSPACE_SETTINGS_CHANGED_EVENT, syncModelLabel);
    return () => {
      window.removeEventListener(WORKSPACE_SETTINGS_CHANGED_EVENT, syncModelLabel);
    };
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
        return updateActiveSession(prev, {
          messages: nextMessages,
          activeSkillId: nextSkillId,
          title,
          createDraftContext:
            nextSkillId === "create-draft"
              ? snapshotCreateDraftContext(createDraftContextRef.current)
              : null,
        });
      });
      scheduleDebouncedPersist();
    },
    [scheduleDebouncedPersist],
  );

  const interruptForSwitch = useCallback(async () => {
    if (!isStreaming) return;

    const assistantId = streamingAssistantId;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStreamingAssistantId(null);
    stopContextRef.current = null;

    if (assistantId) {
      setPendingContinueAssistantId(assistantId);
    }

    const lessonId = currentLessonIdRef.current;
    if (lessonId) {
      await flushSessionToStorage(lessonId);
    }
  }, [flushSessionToStorage, isStreaming, streamingAssistantId]);

  useEffect(() => {
    if (!agentChatControllerRef) return;
    agentChatControllerRef.current = {
      isStreaming: () => isStreaming,
      interruptForSwitch,
    };
    return () => {
      agentChatControllerRef.current = null;
    };
  }, [agentChatControllerRef, interruptForSwitch, isStreaming]);

  useEffect(() => {
    if (!lessonId || sessionSwitchRef.current === null) return;
    if (!chatStorageRef.current) return;
    persistSession(messages, activeSkillId);
  }, [messages, activeSkillId, lessonId, persistSession]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const targetLessonId = currentLessonIdRef.current;
      if (!targetLessonId) return;
      const snapshot = buildStorageSnapshot();
      if (!snapshot) return;
      void saveLessonSession(targetLessonId, snapshot);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [buildStorageSnapshot]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  const loadContentFiles = useCallback(async () => {
    const params = currentLessonPath
      ? `?current=${encodeURIComponent(currentLessonPath)}`
      : "";
    const res = await fetch(`/api/agent/files${params}`);
    const data = (await res.json()) as { files?: AgentFileOption[] };
    return data.files ?? [];
  }, [currentLessonPath]);

  const buildVariables = useCallback(
    (skillId: string, contextItemsJson?: string): Record<string, string> | { error: string } => {
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
            target: course?.target ?? "",
            cross_series_prev: course?.cross_series_prev ?? [],
            cross_series_next: course?.cross_series_next ?? [],
          },
          contextItems: contextItemsJson ?? createDraftContextRef.current.contextItemsJson,
          availableTags: collectAllLessonTags(series),
        });
      }
      return {};
    },
    [series, lesson, course],
  );

  const resolveCreateDraftContextItems = useCallback(
    async (options: {
      userMessage: AgentChatMessage;
      history: AgentChatMessage[];
    }): Promise<{ contextItemsJson: string } | { error: string }> => {
      const state = createDraftContextRef.current;

      const query = resolveSearchQueryRequest({
        userMessage: options.userMessage.content,
        history: options.history,
        lastSearchQuery: state.lastSearchQuery,
        searchResultsApproved: state.searchResultsApproved,
      });

      if (query) {
        const res = await fetch(
          withContextMode(
            `/api/context/items/search?q=${encodeURIComponent(query)}`,
          ),
        );
        if (!res.ok) {
          let message = "社内コンテキストの取得に失敗しました";
          try {
            const data = (await res.json()) as { error?: string };
            message = data.error ?? message;
          } catch {
            // ignore
          }
          return { error: message };
        }

        const data = (await res.json()) as { items?: ContextItem[] };
        state.searchResults = data.items ?? [];
        state.searchPerformed = true;
        state.lastSearchQuery = query;
        state.searchResultsApproved = false;
        state.contextItemsJson = JSON.stringify(state.searchResults, null, 2);
        return { contextItemsJson: state.contextItemsJson };
      }

      if (
        shouldApproveSearchResults({
          userMessage: options.userMessage.content,
          history: options.history,
          searchResultsApproved: state.searchResultsApproved,
          hasSearchResults: state.searchResults.length > 0,
        })
      ) {
        state.searchResultsApproved = true;
      }

      if (state.searchResults.length > 0) {
        state.contextItemsJson = JSON.stringify(state.searchResults, null, 2);
        return { contextItemsJson: state.contextItemsJson };
      }

      return { contextItemsJson: "[]" };
    },
    [],
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
      let contextItemsJson: string | undefined;
      if (options.skillId === "create-draft") {
        const contextResult = await resolveCreateDraftContextItems({
          userMessage: options.userMessage,
          history: options.history,
        });
        if ("error" in contextResult) {
          setError(contextResult.error);
          return;
        }
        contextItemsJson = contextResult.contextItemsJson;
      }

      const variablesResult = buildVariables(options.skillId, contextItemsJson);
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
        setPendingContinueAssistantId(null);
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
    [buildVariables, onOpenSettings, resolveCreateDraftContextItems],
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
    stickToBottomRef.current = true;
    setInput("");
    await invokeSkill({
      userMessage,
      history: messages,
      skillId: activeSkillId,
    });
  }, [activeSkillId, input, invokeSkill, isStreaming, lesson, messages]);

  const handleContinueGeneration = useCallback(async () => {
    if (!activeSkillId || isStreaming || !pendingContinueAssistantId) return;

    const userMessage: AgentChatMessage = {
      id: createMessageId(),
      role: "user",
      content: CONTINUE_USER_MESSAGE,
      createdAt: new Date().toISOString(),
    };
    setPendingContinueAssistantId(null);
    stickToBottomRef.current = true;
    await invokeSkill({
      userMessage,
      history: messages,
      skillId: activeSkillId,
    });
  }, [activeSkillId, invokeSkill, isStreaming, messages, pendingContinueAssistantId]);

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
    createDraftContextRef.current = restoreCreateDraftContext(session.createDraftContext);
    setMessages(session.messages);
    setActiveSkillId(session.activeSkillId);
    setInput("");
    setError(null);
    setRetryPayload(null);
    setPendingContinueAssistantId(null);
  }, []);

  useEffect(() => {
    if (!lessonId) return;

    let cancelled = false;

    async function loadLessonChat(targetLessonId: string) {
      const prevId = currentLessonIdRef.current;
      if (prevId && prevId !== targetLessonId) {
        await flushSessionToStorage(prevId);
      }

      const storage = await loadLessonSession(targetLessonId);
      if (cancelled) return;

      currentLessonIdRef.current = targetLessonId;
      lastPersistedFingerprintRef.current = "";
      setChatStorage(storage);
      applySessionState(storage.activeSessionId, storage);
      sessionSwitchRef.current = storage.activeSessionId;
    }

    void loadLessonChat(lessonId);

    return () => {
      cancelled = true;
    };
  }, [applySessionState, flushSessionToStorage, lessonId]);

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
      if (lessonId) void saveLessonSession(lessonId, next);
      setChatStorage(next);
      applySessionState(sessionId, next);
      setHistoryOpen(false);
    },
    [activeSkillId, applySessionState, chatStorage, input, lessonId, messages, persistSession],
  );

  const handleNewSession = useCallback(() => {
    if (!chatStorage) return;
    if (input.trim() && !window.confirm("入力中の内容は失われます。新規会話を開始しますか？")) {
      return;
    }
    persistSession(messages, activeSkillId);
    const next = addSession(chatStorage);
    if (lessonId) void saveLessonSession(lessonId, next);
    setChatStorage(next);
    applySessionState(next.activeSessionId, next);
    setHistoryOpen(false);
  }, [activeSkillId, applySessionState, chatStorage, input, lessonId, messages, persistSession]);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      if (!chatStorage) return;
      const wasActive = sessionId === chatStorage.activeSessionId;
      const next = deleteSession(chatStorage, sessionId);
      if (lessonId) void saveLessonSession(lessonId, next);
      setChatStorage(next);
      if (wasActive) {
        applySessionState(next.activeSessionId, next);
      }
      setDeleteSessionTargetId(null);
      setHistoryOpen(false);
    },
    [applySessionState, chatStorage, lessonId],
  );

  const handleBuiltinCommand = useCallback(
    (command: "clear" | "export") => {
      if (command === "clear") {
        if (chatStorage) {
          setDeleteSessionTargetId(chatStorage.activeSessionId);
        }
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
    [activeSession, activeSkillId, chatStorage, messages],
  );

  const deleteSessionTarget = useMemo(
    () =>
      deleteSessionTargetId
        ? sortedSessions.find((session) => session.id === deleteSessionTargetId)
        : undefined,
    [deleteSessionTargetId, sortedSessions],
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

  const handleConfirmOverwrite = useCallback(() => {
    if (!overwriteTarget || !onOverwriteEditor || !lesson) return;
    const extracted = extractMarkdownBlock(overwriteTarget.content);
    let contextItemTags: string[] = [];
    try {
      const items = JSON.parse(
        createDraftContextRef.current.contextItemsJson,
      ) as ContextItem[];
      contextItemTags = items.flatMap((item) => item.tags);
    } catch {
      /* ignore invalid JSON */
    }
    const markdown = normalizeDraftMarkdownForLesson(
      extracted,
      { seriesName: lesson.series, courseName: lesson.course },
      lesson,
      {
        availableTags: collectAllLessonTags(series),
        contextItemTags,
      },
    );
    onOverwriteEditor(markdown);
    setOverwriteTarget(null);
  }, [lesson, onOverwriteEditor, overwriteTarget, series]);

  const sessionTitle = activeSession?.title ?? DEFAULT_SESSION_TITLE;

  return (
    <div className={cn("agent-chat-pane flex h-full min-h-0 flex-col", className)}>
      <div className="relative z-10 shrink-0 bg-[var(--agent-chat-pane-bg)] px-3 pt-3 pb-2">
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
                <div
                  key={session.id}
                  className={cn(
                    "flex flex-col gap-0.5 border-b border-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted/60",
                    session.id === chatStorage?.activeSessionId && "bg-muted",
                  )}
                >
                  <button
                    type="button"
                    className="w-full truncate text-left font-medium text-foreground"
                    onClick={() => handleSwitchSession(session.id)}
                  >
                    {session.title}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-muted-foreground"
                      onClick={() => handleSwitchSession(session.id)}
                    >
                      {session.activeSkillId ?? "スキル未選択"} · {session.messages.length} 件 ·{" "}
                      {formatSessionUpdatedAt(session.updatedAt)}
                    </button>
                    <WorkspaceTooltip
                      label="会話を削除"
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label="会話を削除"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteSessionTargetId(session.id);
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      }
                    />
                  </div>
                </div>
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
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={chatScrollRef}
          className="workspace-scrollbar h-full min-h-0 overflow-y-auto overscroll-y-contain"
          onScroll={(event) => {
            const element = event.currentTarget;
            const distanceFromBottom =
              element.scrollHeight - element.scrollTop - element.clientHeight;
            stickToBottomRef.current = distanceFromBottom < 80;
          }}
        >
          <div className="px-12 py-4">
        {richMarkdown ? (
          messages.length === 0 ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
            / でスキルを選択し、メッセージを送信してください
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {messages.map((message) => {
              const isStreamingMessage =
                isStreaming && message.id === streamingAssistantId;
              const showContinue =
                message.role === "assistant" &&
                !isStreamingMessage &&
                pendingContinueAssistantId === message.id &&
                Boolean(message.content);
              const showActions =
                message.role === "assistant" &&
                !isStreamingMessage &&
                Boolean(message.content);
              const copied = copiedMessageId === message.id;

              if (message.role === "user") {
                return (
                  <div key={message.id} className="flex w-full justify-end">
                    <div className="max-w-[min(70%,28rem)] rounded-2xl bg-muted px-3 py-2 text-sm text-foreground">
                      <AgentChatMessageContent
                        content={message.content}
                        variant="user"
                        richMarkdown={richMarkdown}
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className="flex w-full flex-col gap-2 text-sm">
                  {message.content ? (
                    <AgentChatMessageContent
                      content={message.content}
                      richMarkdown={richMarkdown}
                    />
                  ) : (
                    <span className="text-muted-foreground">...</span>
                  )}
                  {showActions || showContinue ? (
                    <div className="flex items-center gap-2">
                      {showContinue ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleContinueGeneration()}
                        >
                          続きを生成
                        </Button>
                      ) : null}
                      {showActions ? (
                        <>
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
                      {onOverwriteEditor && lesson ? (
                        <WorkspaceTooltip
                          label="エディタに上書き"
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label="エディタに上書き"
                              onClick={() =>
                                setOverwriteTarget({
                                  messageId: message.id,
                                  content: message.content,
                                })
                              }
                            >
                              <FilePen className="size-3.5" />
                            </Button>
                          }
                        />
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTimestamp(message)}
                      </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
        ) : null}
          </div>
        </div>
        <div aria-hidden className="agent-chat-pane__scroll-fade agent-chat-pane__scroll-fade-top" />
        <div aria-hidden className="agent-chat-pane__scroll-fade agent-chat-pane__scroll-fade-bottom" />
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

      <div className="relative z-10 shrink-0 bg-[var(--agent-chat-pane-bg)] px-12">
        <AgentChatInput
        value={input}
        onChange={setInput}
        onSend={() => void handleSend()}
        onAfterSend={() => {
          stickToBottomRef.current = true;
          requestAnimationFrame(() => scrollChatToBottom());
        }}
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

      <AlertDialog
        open={deleteSessionTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteSessionTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>会話を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteSessionTarget
                ? `「${deleteSessionTarget.title}」を履歴から削除します。この操作は取り消せません。`
                : "この会話を履歴から削除します。この操作は取り消せません。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSessionTargetId) {
                  handleDeleteSession(deleteSessionTargetId);
                }
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={overwriteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setOverwriteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>レッスン本文を上書きしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              AI 応答の Markdown 内容で現在のレッスン本文を置き換えます。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite}>
              上書き
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
