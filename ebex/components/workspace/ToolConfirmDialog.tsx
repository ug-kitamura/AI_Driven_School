"use client";

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
import type { ToolConfirmRequiredEvent } from "@/lib/agent/stream-client";

type Props = {
  request: ToolConfirmRequiredEvent | null;
  onApprove: () => void;
  onReject: () => void;
};

function describeRequest(request: ToolConfirmRequiredEvent): {
  title: string;
  description: string;
  actionLabel: string;
} {
  switch (request.kind) {
    case "overwrite":
      return {
        title: "既存ファイルを上書きしますか？",
        description: `プロジェクト内の既存ファイルに上書きしようとしています。\n\n対象: ${request.path}\n\nこの操作は元に戻せません。`,
        actionLabel: "上書きする",
      };
    case "outside-project-read":
      return {
        title: "プロジェクト外のファイルを読み取りますか？",
        description: `開いているプロジェクトフォルダの外を指すファイルを読み取ろうとしています。\n\n対象: ${request.path}`,
        actionLabel: "読み取りを許可",
      };
    case "outside-project-write":
      return {
        title: "プロジェクト外へ書き込みますか？",
        description: `開いているプロジェクトフォルダの外へ${request.isNew ? "新規ファイルを作成" : "既存ファイルを上書き"}しようとしています。\n\n対象: ${request.path}\n区別: ${request.isNew ? "新規作成" : "上書き"}`,
        actionLabel: request.isNew ? "作成を許可" : "上書きを許可",
      };
  }
}

export function ToolConfirmDialog({ request, onApprove, onReject }: Props) {
  const open = request !== null;
  const info = request ? describeRequest(request) : null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onReject();
      }}
    >
      {info ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{info.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {info.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onReject}>拒否する</AlertDialogCancel>
            <AlertDialogAction onClick={onApprove}>
              {info.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
