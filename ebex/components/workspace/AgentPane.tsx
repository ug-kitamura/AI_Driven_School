"use client";

import dynamic from "next/dynamic";
import { Leaf, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentChatController } from "@/lib/agent-chat-controller";

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
  onOpenSettings: () => void;
  onOpenPurpose: () => void;
  onOverwriteEditor: (markdown: string) => void;
  agentChatControllerRef: React.MutableRefObject<AgentChatController | null>;
};

export function AgentPane({
  folderId,
  currentFilePath,
  onOpenSettings,
  onOpenPurpose,
  onOverwriteEditor,
  agentChatControllerRef,
}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-end gap-1 border-b px-3 py-2">
        <span className="mr-auto text-sm font-medium">Agent</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="EBE Purpose"
          onClick={onOpenPurpose}
        >
          <Leaf className="size-4" />
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
          currentFilePath={currentFilePath}
          onOpenSettings={onOpenSettings}
          onOverwriteEditor={onOverwriteEditor}
          agentChatControllerRef={agentChatControllerRef}
          className="h-full"
        />
      </div>
    </div>
  );
}
