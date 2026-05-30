import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 属性名 ↔ 属性値（同一グループ内・近い） */
const LABEL_VALUE_GAP = "gap-1.5";

/** 属性値の下 ↔ 次の属性名（グループ間・広い） */
const GROUP_GAP_Y = "gap-y-4";

/** 1 属性 = ラベル + 値 */
export const META_DIALOG_FIELD = cn("flex min-w-0 flex-col", LABEL_VALUE_GAP);

/** 複数属性の 2 列レイアウト（コースメタなど） */
export const META_DIALOG_GRID = cn(
  "grid grid-cols-2",
  "gap-x-4",
  GROUP_GAP_Y,
);

/** 1 列レイアウト（レッスンメタなど） */
export const META_DIALOG_STACK = cn("flex flex-col", GROUP_GAP_Y);

/** モーダル本文の上下パディング */
export const META_DIALOG_FORM = "py-2";

/** 入力・セレクトの共通見た目 */
export const META_DIALOG_CONTROL = "bg-white";

type MetaDialogFieldProps = {
  children: ReactNode;
  className?: string;
};

export function MetaDialogField({ children, className }: MetaDialogFieldProps) {
  return <div className={cn(META_DIALOG_FIELD, className)}>{children}</div>;
}
