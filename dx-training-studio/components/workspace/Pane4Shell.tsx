"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Bot, FolderPlus, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { AgentChatDraftMap } from "@/components/workspace/agent-chat-draft";
import type { SkillSummary } from "@/lib/agent/skill-loader";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import type { Pane4View } from "@/lib/pane4-view-storage";
import { savePane4View } from "@/lib/pane4-view-storage";
import type { Course, Lesson, Series } from "@/lib/schema";
import type { Pane3Mode } from "@/components/workspace/Workspace";

/** Select は空文字 value を扱えないため「フォルダなし＝レッスンモード」の番兵値を使う */
const NO_FOLDER_VALUE = "__no-folder__";

type AgentFolderEntry = { id: string; ino?: string };

function toWorkspaceTreeNodes(
  folders: AgentFolderEntry[],
): WorkspaceTreeNode[] {
  return folders.map((folder) => ({
    name: folder.id,
    path: folder.id,
    files: [],
    children: [],
    ino: folder.ino,
  }));
}

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

  // ---- 案件フォルダ（workspace/ 直下）とスキルカタログ。フォルダ切替で
  // AgentChatPane はリマウントされるため、非依存の状態はここで保持する ----
  const [agentFolderId, setAgentFolderId] = useState<string | null>(null);
  const [agentFolders, setAgentFolders] = useState<AgentFolderEntry[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const draftsRef = useRef<AgentChatDraftMap>(new Map());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");
  const [createFolderError, setCreateFolderError] = useState<string | null>(
    null,
  );

  const refreshAgentFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/workspace-folders");
      const data = (await res.json()) as { folders?: AgentFolderEntry[] };
      setAgentFolders(data.folders ?? []);
    } catch {
      setAgentFolders([]);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/agent/workspace-folders")
      .then((res) => res.json())
      .then((data: { folders?: AgentFolderEntry[] }) => {
        setAgentFolders(data.folders ?? []);
      })
      .catch(() => {
        setAgentFolders([]);
      });
  }, []);

  useEffect(() => {
    void fetch("/api/agent/skills")
      .then((res) => res.json())
      .then((data: { skills?: SkillSummary[] }) => {
        setSkills(data.skills ?? []);
        setSkillsError(null);
      })
      .catch(() => {
        setSkillsError("スキル一覧の取得に失敗しました");
      });
  }, []);

  const handleCreateFolder = useCallback(async () => {
    const name = createFolderName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/agent/workspace-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setCreateFolderError(data.error ?? "フォルダを作成できませんでした");
        return;
      }
      setCreateDialogOpen(false);
      setCreateFolderName("");
      setCreateFolderError(null);
      await refreshAgentFolders();
      setAgentFolderId(name);
    } catch {
      setCreateFolderError("フォルダを作成できませんでした");
    }
  }, [createFolderName, refreshAgentFolders]);

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
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3 py-0">
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
            "absolute inset-0 flex flex-col",
            pane4View !== "agent" && "hidden",
          )}
        >
          <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
            <Select
              items={[
                { value: NO_FOLDER_VALUE, label: "案件フォルダなし" },
                ...agentFolders.map((folder) => ({
                  value: folder.id,
                  label: folder.id,
                })),
              ]}
              value={agentFolderId ?? NO_FOLDER_VALUE}
              onValueChange={(value) => {
                if (!value) return;
                setAgentFolderId(value === NO_FOLDER_VALUE ? null : value);
              }}
            >
              <SelectTrigger
                aria-label="案件フォルダ"
                className="h-7 min-w-0 flex-1 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FOLDER_VALUE}>
                  案件フォルダなし
                </SelectItem>
                {agentFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="案件フォルダを作成"
              onClick={() => {
                setCreateFolderError(null);
                setCreateDialogOpen(true);
              }}
            >
              <FolderPlus className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <AgentChatPane
              key={agentFolderId ?? "lesson-mode"}
              folderId={agentFolderId ?? undefined}
              folders={toWorkspaceTreeNodes(agentFolders)}
              series={series}
              lesson={lesson}
              course={course}
              currentLessonPath={currentLessonPath}
              onOpenSettings={onOpenSettings}
              onOverwriteEditor={onOverwriteEditor}
              agentChatControllerRef={agentChatControllerRef}
              onControllerReady={onControllerReady}
              richMarkdown={pane4View === "agent"}
              draftsRef={draftsRef}
              skills={skills}
              skillsError={skillsError}
            />
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>案件フォルダを作成</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Input
                  autoFocus
                  value={createFolderName}
                  onChange={(event) => setCreateFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateFolder();
                    }
                  }}
                  placeholder="例: 20260810-onenote-basics"
                />
                {createFolderError ? (
                  <p className="text-xs text-destructive">
                    {createFolderError}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCreateFolder()}
                  disabled={!createFolderName.trim()}
                >
                  作成
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
