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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_FORM,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ダイアログ見出し（例: シリーズを追加 / コース名を変更） */
  title: string;
  /** 入力欄ラベル（例: シリーズ名） */
  label: string;
  placeholder?: string;
  /** 開いたときの初期値。追加は空文字、リネームは現在名 */
  initialValue?: string;
  /** 確定ボタンのラベル（既定: 保存） */
  submitLabel?: string;
  onSubmit: (name: string) => void;
};

/** ツリーの追加・リネームで共用する名前入力ダイアログ */
export function NameDialog({
  open,
  onOpenChange,
  title,
  label,
  placeholder,
  initialValue = "",
  submitLabel = "保存",
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className={META_DIALOG_FORM}>
          <MetaDialogField>
            <Label htmlFor="name-dialog-input">{label}</Label>
            <Input
              id="name-dialog-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className={META_DIALOG_CONTROL}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </MetaDialogField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={!value.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
