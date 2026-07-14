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
import { Badge } from "@/components/ui/badge";
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
    case "run-script":
      return {
        title: "スクリプトを実行しますか？",
        description:
          request.script?.purpose?.trim() ||
          "AI が生成したスクリプトを実行しようとしています。",
        actionLabel: "実行を許可",
      };
    case "run-skill-script":
      return {
        title: "スキルのスクリプトを実行しますか？",
        description: `${request.script?.purpose?.trim() || "スキルに同梱されたスクリプトを実行しようとしています。"}\n\nスクリプト: ${request.script?.scriptPath ?? request.path}`,
        actionLabel: "実行を許可",
      };
    case "generate-write":
      return {
        title: "AI 生成でファイルを書き込みますか？",
        description: `${request.generate?.purpose?.trim() || "AI が本文を生成してファイルへ直接書き込もうとしています。"}\n\n対象: ${request.path}\n区別: ${request.isNew ? "新規作成" : "上書き"}\n\nサーバ内で追加の AI 呼び出しを実行し、生成された本文をこのファイルへ書き込みます。`,
        actionLabel: request.isNew ? "生成して作成" : "生成して上書き",
      };
    case "web-search": {
      const query = request.search?.query ?? request.path;
      const purpose = request.search?.purpose?.trim();
      return {
        title: "web 検索を実行しますか？",
        description: `「${query}」について web 検索しますが、よろしいですか？${purpose ? `\n\n目的: ${purpose}` : ""}\n\nこのクエリは外部の検索サービスへ送信されます。`,
        actionLabel: "検索を許可",
      };
    }
    // 未知の種別でも確認を不可視のまま放置しない（TTL で自動拒否される事故の防止）
    default:
      return {
        title: "ツールの実行を許可しますか？",
        description: `AI が確認の必要な操作を実行しようとしています。\n\n種別: ${request.kind}\n対象: ${request.path}`,
        actionLabel: "実行を許可",
      };
  }
}

function ScriptConfirmDetails({
  script,
}: {
  script: NonNullable<ToolConfirmRequiredEvent["script"]>;
}) {
  return (
    <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto text-sm">
      {script.networkWarning ? (
        <Badge variant="destructive">
          ネットワークアクセスの可能性があるコードを含みます
        </Badge>
      ) : null}
      {script.writes.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">書き込み予定</span>
          <ul className="flex flex-col gap-1">
            {script.writes.map((write) => (
              <li key={write.path} className="flex items-center gap-2">
                <span className="truncate font-mono text-xs">{write.path}</span>
                {write.exists ? (
                  <Badge variant="destructive">上書き</Badge>
                ) : (
                  <Badge variant="secondary">新規</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {script.args && script.args.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">引数</span>
          <span className="font-mono text-xs">{script.args.join(" ")}</span>
        </div>
      ) : null}
      {script.code ? (
        <details>
          <summary className="text-muted-foreground cursor-pointer text-xs select-none">
            コード全文を表示
          </summary>
          <pre className="bg-muted mt-2 max-h-60 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap">
            {script.code}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function GenerateConfirmDetails({
  generate,
}: {
  generate: NonNullable<ToolConfirmRequiredEvent["generate"]>;
}) {
  return (
    <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto text-sm">
      {generate.sections.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">セクション構成</span>
          <ol className="flex list-inside list-decimal flex-col gap-1">
            {generate.sections.map((section) => (
              <li key={section} className="truncate text-xs">
                {section}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {generate.contextPaths.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">参照ファイル</span>
          <ul className="flex flex-col gap-1">
            {generate.contextPaths.map((contextPath) => (
              <li key={contextPath} className="truncate font-mono text-xs">
                {contextPath}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {generate.instruction ? (
        <details>
          <summary className="text-muted-foreground cursor-pointer text-xs select-none">
            生成指示の全文を表示
          </summary>
          <pre className="bg-muted mt-2 max-h-60 overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap">
            {generate.instruction}
          </pre>
        </details>
      ) : null}
    </div>
  );
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
      {request && info ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{info.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {info.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {request.script ? (
            <ScriptConfirmDetails script={request.script} />
          ) : null}
          {request.generate ? (
            <GenerateConfirmDetails generate={request.generate} />
          ) : null}
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
