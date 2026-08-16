"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  META_DIALOG_FORM,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveError?: (message: string) => void;
};

/**
 * 全体メタ（contents/.meta.json）の properties ダイアログ。
 * 現時点の編集対象は description のみ（4階層メタ編集 UI は次 change で刷新）。
 */
export function WorkspaceMetaDialog({ open, onOpenChange, onSaveError }: Props) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/content/workspace-meta")
      .then((res) => res.json())
      .then((data: { description?: string }) => {
        if (cancelled) return;
        setDescription(data.description ?? "");
      })
      .catch(() => {
        if (!cancelled) setDescription("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSave = () => {
    fetch("/api/content/workspace-meta", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch((err: unknown) => {
        onSaveError?.(`全体メタ保存エラー: ${String(err)}`);
      });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>全体メタを編集</DialogTitle>
        </DialogHeader>
        <div className={META_DIALOG_FORM}>
          <MetaDialogField>
            <Label htmlFor="workspace-meta-description">説明（description）</Label>
            <textarea
              id="workspace-meta-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              placeholder="カリキュラム全体の説明（公開サイトの全体トップに表示）"
            />
          </MetaDialogField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
