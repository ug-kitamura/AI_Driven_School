"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Bot, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pane4Toggle } from "@/components/workspace/Pane4Toggle";
import {
  PaneSegmentControl,
  type PaneSegmentOption,
} from "@/components/workspace/PaneSegmentControl";
import { ImageTabBar } from "@/components/workspace/ImageTabBar";
import { ImageManagerPane } from "@/components/workspace/ImageManagerPane";
import { useAgentSessionChrome } from "@/components/workspace/use-agent-session-chrome";
import type { ImageManagerTab } from "@/components/workspace/image-manager/types";
import type { AgentChatController } from "@/lib/agent-chat-controller";
import type { Pane4View } from "@/lib/pane4-view-storage";
import { savePane4View } from "@/lib/pane4-view-storage";
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
    ariaLabel: "Agent",
  },
  {
    value: "images",
    label: "画像",
    icon: <ImageIcon className="size-3" />,
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

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 py-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {pane4View === "agent" ? (
            <span
              className="min-w-0 flex-1 truncate text-xs font-bold text-foreground"
              title={sessionChrome?.sessionTitle ?? undefined}
            >
              {sessionChrome?.sessionTitle ?? ""}
            </span>
          ) : (
            <ImageTabBar
              value={activeImageTab}
              onChange={setActiveImageTab}
              className="min-w-0 flex-1"
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PaneSegmentControl
            value={pane4View}
            options={PANE4_VIEW_OPTIONS}
            onChange={handlePane4ViewChange}
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
