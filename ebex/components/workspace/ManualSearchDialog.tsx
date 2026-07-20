"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ToolConfirmRequiredEvent } from "@/lib/agent/stream-client";

type Props = {
  request: ToolConfirmRequiredEvent | null;
  /** 貼り付けた検索結果テキストで続行する */
  onSubmit: (manualSearchText: string) => void;
  /** 検索をスキップして続行する */
  onSkip: () => void;
};

/**
 * web 検索が未設定の環境での人手フォールバックダイアログ。
 * 検索ワードを提示し、ユーザーが結果＋ソース URL を貼り付けるか、スキップを選ぶ。
 */
export function ManualSearchDialog({ request, onSubmit, onSkip }: Props) {
  const open = request !== null && request.kind === "web-search-manual";
  const query = request?.search?.query ?? request?.path ?? "";
  const purpose = request?.search?.purpose?.trim();
  // 入力欄の初期化は、呼び出し側が toolUseId を key に渡してリマウントすることで行う
  const [text, setText] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkip();
      }}
    >
      {request ? (
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>web 検索は自分で行ってください</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              この環境では web
              検索を自動実行できません。下記のワードでご自身で検索し、結果とソース
              URL を貼り付けてください。検索が不要ならスキップできます。
            </p>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">検索ワード</span>
              <span className="font-mono text-sm">{query}</span>
            </div>
            {purpose ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">目的</span>
                <span className="text-sm">{purpose}</span>
              </div>
            ) : null}
            <textarea
              className="min-h-32 w-full resize-y rounded-md border bg-background p-2 font-mono text-xs"
              placeholder="検索結果の要点とソース URL を貼り付けてください"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onSkip}>
              スキップして続行
            </Button>
            <Button
              type="button"
              disabled={!text.trim()}
              onClick={() => onSubmit(text.trim())}
            >
              貼り付けて続行
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
