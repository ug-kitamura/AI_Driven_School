"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Bot, ChevronDown, History, ImageIcon, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";
import {
  PaneSegmentControl,
  type PaneSegmentOption,
} from "@/components/workspace/PaneSegmentControl";
import { ImageManagerPane } from "@/components/workspace/ImageManagerPane";
import { usePane4CompactHeader } from "@/components/workspace/use-pane4-compact-header";
import { useAgentSessionChrome } from "@/components/workspace/use-agent-session-chrome";
import { IMAGE_MANAGER_TABS } from "@/components/workspace/image-manager/image-manager-constants";
import type { ImageManagerTab } from "@/components/workspace/image-manager/types";
import type { AgentChatController } from "@/lib/agent-chat-controller";
import { formatSessionUpdatedAt } from "@/lib/agent-chat-storage";
import type { Pane4View } from "@/lib/pane4-view-storage";
import { savePane4View } from "@/lib/pane4-view-storage";
import { WorkspaceTooltip } from "@/components/workspace/WorkspaceTooltip";
import type { Course, Lesson, Series } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";

const AgentChatPane = dynamic(
  () =>
    import("@/components/workspace/AgentChatPane").then((m) => m.AgentChatPane),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Agent を読み込み中...
      </div>
    ),
  },
);

const PANE4_VIEW_OPTIONS: ReadonlyArray<PaneSegmentOption<Pane4View>> = [
  {
    value: "agent",
    label: "Agent",
    icon: <Bot className="size-3" />,
    compactIcon: <Bot className="size-3" />,
    ariaLabel: "Agent",
  },
  {
    value: "images",
    label: "画像",
    icon: <ImageIcon className="size-3" />,
    compactIcon: <ImageIcon className="size-3" />,
    ariaLabel: "画像",
  },
];

export type Pane4ShellProps = {
  pane4View: Pane4View;
  onPane4ViewChange: (view: Pane4View) => void;
  onTogglePane4: () => void;
  series: Series[];
  lesson: Lesson | undefined;
  course: Course | undefined;
  pane3Mode: Pane3Mode;
  onInsertImage: (markdown: string) => boolean;
  editorCommentPrompt: string | null;
  editorCursorOffset: number | null;
  onOpenSettings: () => void;
  currentLessonPath: string | null;
  agentChatControllerRef: React.MutableRefObject<AgentChatController | null>;
  onOverwriteEditor: (markdown: string) => void;
  onImageAssetsChanged?: (removedPaths?: string | string[]) => void;
};

export function Pane4Shell({
  pane4View,
  onPane4ViewChange,
  onTogglePane4,
  series,
  lesson,
  course,
  pane3Mode,
  onInsertImage,
  editorCommentPrompt,
  editorCursorOffset,
  onOpenSettings,
  currentLessonPath,
  agentChatControllerRef,
  onOverwriteEditor,
  onImageAssetsChanged,
}: Pane4ShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const compact = usePane4CompactHeader(containerRef);
  const [controllerVersion, setControllerVersion] = useState(0);
  const [activeImageTab, setActiveImageTab] = useState<ImageManagerTab>("used");

  const sessionChrome = useAgentSessionChrome(
    agentChatControllerRef,
    controllerVersion,
  );

  const handlePane4ViewChange = useCallback(
    (view: Pane4View) => {
      onPane4ViewChange(view);
      savePane4View(view);
    },
    [onPane4ViewChange],
  );

  const onControllerReady = useCallback(() => {
    setControllerVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!sessionChrome?.historyOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!historyRef.current?.contains(event.target as Node)) {
        sessionChrome.setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [sessionChrome?.historyOpen, sessionChrome]);

  const imageTabOptions: ReadonlyArray<PaneSegmentOption<ImageManagerTab>> =
    IMAGE_MANAGER_TABS.map((tab) => ({
      value: tab.value,
      label: tab.label,
      icon: tab.icon,
      compactIcon: tab.icon,
      ariaLabel: tab.label,
    }));

  return (
    <div ref={containerRef} className="flex h-full min-w-0 flex-col overflow-hidden bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 py-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {pane4View === "agent" ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1 border-0 bg-muted text-foreground hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80"
                onClick={() => sessionChrome?.handleNewSession()}
              >
                <Plus className="size-3" />
                {compact ? null : "新規"}
              </Button>
              <div ref={historyRef} className="relative shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1 border-0 bg-muted text-foreground hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/80"
                  onClick={() =>
                    sessionChrome?.setHistoryOpen((open) => !open)
                  }
                >
                  <History className="size-3" />
                  {compact ? null : "履歴"}
                  {compact ? null : <ChevronDown className="size-3" />}
                </Button>
                {sessionChrome?.historyOpen ? (
                  <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-72 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {sessionChrome.sortedSessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "flex flex-col gap-0.5 border-b border-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted/60",
                          session.id === sessionChrome.activeSessionId &&
                            "bg-muted",
                        )}
                      >
                        <button
                          type="button"
                          className="w-full truncate text-left font-medium text-foreground"
                          onClick={() =>
                            sessionChrome.handleSwitchSession(session.id)
                          }
                        >
                          {session.title}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left text-muted-foreground"
                            onClick={() =>
                              sessionChrome.handleSwitchSession(session.id)
                            }
                          >
                            {session.activeSkillId ?? "スキル未選択"} ·{" "}
                            {session.messages.length} 件 ·{" "}
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
                                  sessionChrome.requestDeleteSession(session.id);
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
              {!compact && sessionChrome ? (
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {sessionChrome.sessionTitle}
                </span>
              ) : null}
            </>
          ) : (
            <PaneSegmentControl
              value={activeImageTab}
              options={imageTabOptions}
              onChange={setActiveImageTab}
              compact={compact}
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PaneSegmentControl
            value={pane4View}
            options={PANE4_VIEW_OPTIONS}
            onChange={handlePane4ViewChange}
            compact={compact}
          />
          <Pane4Toggle open onToggle={onTogglePane4} />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={cn(
            "absolute inset-0",
            pane4View !== "agent" && "hidden",
          )}
        >
          <AgentChatPane
              series={series}
              lesson={lesson}
              course={course}
              currentLessonPath={currentLessonPath}
              onOpenSettings={onOpenSettings}
              onOverwriteEditor={onOverwriteEditor}
              agentChatControllerRef={agentChatControllerRef}
              onControllerReady={onControllerReady}
              richMarkdown={pane4View === "agent"}
          />
        </div>
        <div
          className={cn(
            "absolute inset-0",
            pane4View !== "images" && "hidden",
          )}
        >
          <ImageManagerPane
            series={series}
            lesson={lesson}
            pane3Mode={pane3Mode}
            activeTab={activeImageTab}
            onActiveTabChange={setActiveImageTab}
            onInsertImage={onInsertImage}
            editorCommentPrompt={editorCommentPrompt}
            editorCursorOffset={editorCursorOffset}
            pane4Open
            onImageAssetsChanged={onImageAssetsChanged}
          />
        </div>
      </div>
    </div>
  );
}
