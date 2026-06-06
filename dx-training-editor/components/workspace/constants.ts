/** Dashed full-width add action (course / lesson / series lists). */
export const ADD_LIST_BUTTON_CLASS =
  "w-full justify-between gap-1 border border-dashed border-border text-xs text-muted-foreground hover:border-primary hover:text-primary";

/** コース/レッスン行の左右余白（追加ボタン size=sm の px-2.5 と揃える） */
export const LIST_ROW_X_INSET_CLASS = "px-2.5";

/** この距離未満のポインタ操作はクリック（選択）として扱う */
export const SORTABLE_POINTER_ACTIVATION = { distance: 8 } as const;
