"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentSessionChrome } from "@/components/workspace/use-agent-session-chrome";
import type { WorkspaceTreeNode } from "@/lib/workspace-loader";
import type { AgentChatController } from "@/lib/agent-chat-controller";

const GITHUB_REPO_URL = "https://github.com/ug-kitamura/AI_Driven_School";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.75-1.335-1.75-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
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

type Props = {
  folderId: string;
  currentFilePath: string | null;
  folders: WorkspaceTreeNode[];
  onOpenSettings: () => void;
  onOverwriteEditor: (markdown: string) => void;
  agentChatControllerRef: React.MutableRefObject<AgentChatController | null>;
};

export function AgentPane({
  folderId,
  currentFilePath,
  folders,
  onOpenSettings,
  onOverwriteEditor,
  agentChatControllerRef,
}: Props) {
  const [controllerVersion, setControllerVersion] = useState(0);
  const sessionChrome = useAgentSessionChrome(
    agentChatControllerRef,
    controllerVersion,
  );
  const sessionTitle = sessionChrome?.sessionTitle ?? "";
  const isStreaming = sessionChrome?.isStreaming ?? false;

  const onControllerReady = useCallback(() => {
    setControllerVersion((v) => v + 1);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-end gap-1 border-b px-3 py-0">
        <div className="mr-auto flex min-w-0 flex-1 items-center gap-2">
          {isStreaming ? (
            <Loader2
              className="size-4 shrink-0 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : null}
          <span
            className="min-w-0 flex-1 truncate text-sm font-medium"
            title={sessionTitle || undefined}
          >
            {sessionTitle}
          </span>
          {isStreaming ? <span className="sr-only">Agent 実行中</span> : null}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="GitHub リポジトリを開く"
          nativeButton={false}
          render={
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <GitHubIcon className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="設定"
          onClick={onOpenSettings}
        >
          <Settings className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <AgentChatPane
          folderId={folderId || undefined}
          folders={folders}
          currentFilePath={currentFilePath}
          onOpenSettings={onOpenSettings}
          onOverwriteEditor={onOverwriteEditor}
          agentChatControllerRef={agentChatControllerRef}
          onControllerReady={onControllerReady}
          className="h-full"
        />
      </div>
    </div>
  );
}
