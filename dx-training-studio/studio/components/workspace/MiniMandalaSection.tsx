"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LazyMandala } from "@/components/workspace/mandala/LazyMandala";
import { buildMandalaGraph } from "@/lib/mandala/build-graph";
import type { Series, Course } from "@/lib/schema";

type Props = {
  series: Series[];
  /** 選択中コース。未選択（undefined）なら領域ごと畳む */
  course: Course | undefined;
  onSelectCourse: (courseId: string) => void;
  /**
   * モーダルの開閉は親（Workspace）が持つ制御プロップ。
   * ⚠ 内部 state に戻さないこと——CourseMetaView は `key={course.id}` で
   * コース遷移のたび再マウントされるため、内部 state だと
   * 「モーダルからノードをクリックして遷移 → モーダルが消える」に戻る
   */
  modalOpen: boolean;
  onModalOpenChange: (open: boolean) => void;
};

/** コースメタビュー右列のミニ曼陀羅（サムネイル＋拡大モーダル） */
export function MiniMandalaSection({
  series,
  course,
  onSelectCourse,
  modalOpen,
  onModalOpenChange,
}: Props) {
  const graph = useMemo(() => buildMandalaGraph(series), [series]);

  /**
   * ノードクリックで遷移した直後にモーダルが閉じるのを抑える。
   * 遷移でツリーの選択が変わり、その副作用で開閉プロップが揺れるため。
   */
  const suppressCloseRef = useRef(false);

  const handleOpenChange = useCallback(
    (open: boolean, eventDetails?: { cancel?: () => void }) => {
      if (!open && suppressCloseRef.current) {
        eventDetails?.cancel?.();
        return;
      }
      onModalOpenChange(open);
    },
    [onModalOpenChange],
  );

  const handleSelectFromModal = useCallback(
    (courseId: string) => {
      suppressCloseRef.current = true;
      onSelectCourse(courseId);
      window.setTimeout(() => {
        suppressCloseRef.current = false;
      }, 300);
    },
    [onSelectCourse],
  );

  const modal = (
    <Dialog open={modalOpen} onOpenChange={handleOpenChange}>
      {/* 跨ぎ先が 3 つ以上あるコースでも横に収まる幅。カード自体は広げない。
          ⚠ 高さの主張はここ 1 箇所に集める——ダイアログの上限とキャンバスの高さを
          別々に指定すると、収まらないときにフレックスがキャンバスを縮め、
          フィット済みの表示がそのぶんずれる */}
      <DialogContent className="flex max-h-[85vh] min-h-[20rem] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle>ミニ曼陀羅</DialogTitle>
        </DialogHeader>
        {course ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <LazyMandala
              graph={graph}
              scope={{ kind: "course", courseId: course.id }}
              variant="card"
              currentCourseId={course.id}
              fill
              onSelectCourse={handleSelectFromModal}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  // コース未選択時は領域ごと畳む
  // （モーダルは遷移の途中で開いたままにできるよう常に描く）
  if (!course) return modal;

  return (
    <>
      {/* 枠はサムネイルのボタン自身が持つ1枚だけ。⚠ ここに border や余白を
          足さないこと——呼び出し側（ペイン2 のフィールド）と二重・三重になる。
          高さは親のセルに追随（h-full）——グラフ側が大きくても親を押し広げない */}
      <div className="h-full min-w-0">
        <button
          type="button"
          // ⚠ 平常時に地を敷かないこと——キャンバス側がほぼ透明な地を持つので、
          // 二重になって意図した薄さにならない。地はキャンバスの 1 枚に任せ、
          // 3 つの面（サムネイル・拡大モーダル・全体曼陀羅）で同じ絵に見せる。
          // ホバーの地は残す——押せることの手がかりで、平常時の見た目は変えない
          className="block h-full w-full min-w-0 cursor-zoom-in overflow-hidden rounded border border-border/50 p-1 text-left transition-colors hover:bg-muted/40"
          onClick={() => onModalOpenChange(true)}
          aria-label="ミニ曼陀羅を拡大表示"
        >
          {/* サムネイルは compact ノード——カードのまま縮めると縮小率が上がって
              文字が潰れる。操作は無効で、クリックは拡大モーダルを開く 1 動作だけ */}
          <div className="pointer-events-none h-full w-full min-w-0">
            <LazyMandala
              graph={graph}
              scope={{ kind: "course", courseId: course.id }}
              variant="compact"
              currentCourseId={course.id}
              fill
              staticView
            />
          </div>
        </button>
      </div>
      {modal}
    </>
  );
}
