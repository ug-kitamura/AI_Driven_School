"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { getLessonBody } from "@/lib/lesson-frontmatter";
import { loadWorkspaceSettings } from "@/lib/workspace-settings";
import type { Course, Lesson, Series } from "@/lib/schema";
import type { SkillSummary } from "@/lib/agent/skill-loader";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  series: Series[];
  lesson: Lesson | undefined;
  course: Course | undefined;
  currentLessonPath: string | null;
  onInsertMarkdown: (markdown: string) => void;
  onOpenSettings: () => void;
};

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AgentChatPane({
  series,
  lesson,
  course,
  currentLessonPath,
  onInsertMarkdown,
  onOpenSettings,
}: Props) {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryPayload, setRetryPayload] = useState<{
    userMessage: ChatMessage;
    history: ChatMessage[];
  } | null>(null);

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

  const activeSkill = useMemo(
    () => skills.find((skill) => skill.id === activeSkillId) ?? null,
    [skills, activeSkillId],
  );

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

  const invokeSkill = useCallback(
    async (options: {
      userMessage: ChatMessage;
      history: ChatMessage[];
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
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setIsStreaming(true);
      setError(null);
      setRetryPayload({
        userMessage: options.userMessage,
        history: options.history,
      });

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

        await consumeAnthropicStream(res, (delta) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + delta }
                : message,
            ),
          );
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "スキル実行に失敗しました";
        setError(message);
        setMessages((prev) => prev.filter((message) => message.id !== assistantId));
        if (message === AI_KEY_ERROR) {
          onOpenSettings();
        }
      } finally {
        setIsStreaming(false);
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

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            / でスキルを選択し、メッセージを送信してください
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-8 rounded-lg bg-muted px-3 py-2 text-sm"
                    : "mr-8 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                }
              >
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {message.role === "user" ? "You" : "Assistant"}
                </div>
                {message.role === "user" ? (
                  <div className="whitespace-pre-wrap break-words">
                    {renderUserMessageContent(message.content)}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm">
                      {message.content || "..."}
                    </pre>
                    {message.content ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start"
                        disabled={!lesson}
                        onClick={() => onInsertMarkdown(message.content)}
                      >
                        <FileDown className="size-3" />
                        エディタに挿入
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-2 border-t border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span>{error}</span>
          {retryPayload ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void handleRetry()}>
              <RotateCcw className="size-3" />
              再送
            </Button>
          ) : null}
        </div>
      ) : null}

      <AgentChatInput
        value={input}
        onChange={setInput}
        onSend={() => void handleSend()}
        disabled={false}
        isLoading={isStreaming}
        skills={skills}
        activeSkillId={activeSkillId}
        activeSkillName={activeSkill?.name ?? null}
        onActiveSkillChange={setActiveSkillId}
        onLoadContentFiles={loadContentFiles}
        createDraftDisabled={!lesson}
      />
    </div>
  );
}
