"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 保存完了のチェックマークを出しておく時間（ms） */
export const SAVE_FEEDBACK_MS = 1600;

/** 保存ボタンの表記。⚠ 対象ごとに言い回しを変えないこと（studio-translation spec） */
export const SAVE_LABEL = "保存";

type Props = {
  /** 保存本体。Promise を返すと解決を待って完了表示に切り替える */
  onSave: () => void | Promise<unknown>;
  disabled?: boolean;
  className?: string;
};

/**
 * 保存の完了をボタン自身のチェックマークで示す保存ボタン（studio-translation spec）。
 *
 * - 押した場所から視線を動かさずに完了が分かる
 * - 幅は表記で固定する（`justify-between` ではなくアイコンの席を常に確保）——
 *   sticky なボタン列で幅が動くと目に付くため
 * - 失敗（reject）では完了表示を出さない。エラーの提示は呼び出し側が持つ
 */
export function SaveButton({ onSave, disabled = false, className }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (saving) return;
    setSaved(false);
    let result: void | Promise<unknown>;
    try {
      result = onSave();
    } catch {
      return;
    }
    if (!(result instanceof Promise)) {
      showSaved();
      return;
    }
    setSaving(true);
    void result
      .then(() => {
        if (mountedRef.current) showSaved();
      })
      .catch(() => {
        // 失敗時は完了表示を出さない。エラーは呼び出し側が提示する
      })
      .finally(() => {
        if (mountedRef.current) setSaving(false);
      });
  };

  const showSaved = () => {
    setSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) setSaved(false);
    }, SAVE_FEEDBACK_MS);
  };

  return (
    <Button
      type="button"
      size="sm"
      onClick={handleClick}
      disabled={disabled || saving}
      className={cn("relative", className)}
    >
      {/* アイコンの席を常に確保して幅を固定する */}
      <Check
        className={cn("size-3.5 transition-opacity", saved ? "opacity-100" : "opacity-0")}
        aria-hidden
      />
      {SAVE_LABEL}
      {saved ? <span className="sr-only">保存しました</span> : null}
    </Button>
  );
}
