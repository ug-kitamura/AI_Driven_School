"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  META_DIALOG_CONTROL,
  META_DIALOG_FORM,
  META_DIALOG_GRID,
  MetaDialogField,
} from "@/components/workspace/metaDialogLayout";
import { CrossSeriesCourseTreePicker } from "@/components/workspace/CrossSeriesCourseTreePicker";
import { cn } from "@/lib/utils";
import type { Series, Course, CourseStyle } from "@/lib/schema";
import { COURSE_STYLES, COURSE_STYLE_LABELS } from "@/lib/schema";
import {
  filterCrossSeriesIds,
  getIntraSeriesNeighbors,
  listCrossSeriesCourseCandidates,
  wouldCourseMetaEditCreateCycle,
} from "@/lib/course-flow";

/** Select は空文字を値に使えないため、未設定を表すセンチネル */
const COURSE_STYLE_UNSET = "__unset__";

const COURSE_STYLE_SELECT_ITEMS: Array<{ value: string; label: string }> = [
  { value: COURSE_STYLE_UNSET, label: "未設定" },
  ...COURSE_STYLES.map((style) => ({
    value: style,
    label: COURSE_STYLE_LABELS[style],
  })),
];

type EditMeta = {
  name: string;
  target: string;
  /** 空文字は「未設定」 */
  style: CourseStyle | "";
  crossSeriesPrev: string[];
  crossSeriesNext: string[];
  /** カリキュラムの入口・到達点の宣言。リンク配列とは独立 */
  isStart: boolean;
  isGoal: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: Series[];
  course: Course | undefined;
  onSave: (
    courseId: string,
    meta: Pick<
      Course,
      | "name"
      | "target"
      | "style"
      | "cross_series_prev"
      | "cross_series_next"
      | "is_start"
      | "is_goal"
    >,
  ) => void;
};

/** コースメタ編集ダイアログ（ツリーの properties から開く） */
export function CourseMetaDialog({
  open,
  onOpenChange,
  series,
  course,
  onSave,
}: Props) {
  const [cycleWarning, setCycleWarning] = useState(false);
  const [editMeta, setEditMeta] = useState<EditMeta>({
    name: "",
    target: "",
    style: "",
    crossSeriesPrev: [],
    crossSeriesNext: [],
    isStart: false,
    isGoal: false,
  });

  useEffect(() => {
    if (!open || !course) return;
    setEditMeta({
      name: course.name,
      target: course.target ?? "",
      style: course.style ?? "",
      crossSeriesPrev: filterCrossSeriesIds(
        series,
        course.id,
        course.cross_series_prev,
      ),
      crossSeriesNext: filterCrossSeriesIds(
        series,
        course.id,
        course.cross_series_next,
      ),
      isStart: course.is_start ?? false,
      isGoal: course.is_goal ?? false,
    });
    setCycleWarning(false);
  }, [open, course, series]);

  const intraNeighbors = useMemo(
    () =>
      course
        ? getIntraSeriesNeighbors(series, course.id)
        : { prev: null, next: null },
    [series, course],
  );

  const crossSeriesCandidates = useMemo(
    () => (course ? listCrossSeriesCourseCandidates(series, course.id) : []),
    [series, course],
  );

  if (!course) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setCycleWarning(false);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>コースメタを編集</DialogTitle>
        </DialogHeader>
        <div className={cn(META_DIALOG_GRID, META_DIALOG_FORM)}>
          <MetaDialogField className="col-span-2">
            <Label htmlFor="course-meta-name">コース名</Label>
            <Input
              id="course-meta-name"
              value={editMeta.name}
              onChange={(e) =>
                setEditMeta((prev) => ({ ...prev, name: e.target.value }))
              }
              className={META_DIALOG_CONTROL}
            />
          </MetaDialogField>
          <MetaDialogField>
            <Label>受講対象者</Label>
            <Input
              value={editMeta.target}
              onChange={(e) =>
                setEditMeta((prev) => ({ ...prev, target: e.target.value }))
              }
              placeholder="例: Git未経験の開発者"
              className={META_DIALOG_CONTROL}
            />
          </MetaDialogField>
          <MetaDialogField>
            <Label htmlFor="course-meta-style">受講形態</Label>
            <Select
              items={COURSE_STYLE_SELECT_ITEMS}
              value={editMeta.style || COURSE_STYLE_UNSET}
              onValueChange={(v) => {
                if (!v) return;
                setEditMeta((prev) => ({
                  ...prev,
                  style: v === COURSE_STYLE_UNSET ? "" : (v as CourseStyle),
                }));
              }}
            >
              <SelectTrigger
                id="course-meta-style"
                className={cn(META_DIALOG_CONTROL, "w-full")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COURSE_STYLE_SELECT_ITEMS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MetaDialogField>
          <MetaDialogField>
            <Label>前のコース（同シリーズ）</Label>
            <p className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm">
              {intraNeighbors.prev?.name ?? "なし"}
            </p>
          </MetaDialogField>
          <MetaDialogField>
            <Label>次のコース（同シリーズ）</Label>
            <p className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-sm">
              {intraNeighbors.next?.name ?? "なし"}
            </p>
          </MetaDialogField>
          <MetaDialogField className="min-w-0">
            <Label>前のコース（別シリーズ）</Label>
            <CrossSeriesCourseTreePicker
              candidates={crossSeriesCandidates}
              selectedIds={editMeta.crossSeriesPrev}
              onChange={(ids) => {
                setCycleWarning(false);
                setEditMeta((prev) => ({ ...prev, crossSeriesPrev: ids }));
              }}
              marker={{
                label: "Start",
                checked: editMeta.isStart,
                onToggle: (checked) =>
                  setEditMeta((prev) => ({ ...prev, isStart: checked })),
              }}
            />
          </MetaDialogField>
          <MetaDialogField className="min-w-0">
            <Label>次のコース（別シリーズ）</Label>
            <CrossSeriesCourseTreePicker
              candidates={crossSeriesCandidates}
              selectedIds={editMeta.crossSeriesNext}
              onChange={(ids) => {
                setCycleWarning(false);
                setEditMeta((prev) => ({ ...prev, crossSeriesNext: ids }));
              }}
              marker={{
                label: "Goal",
                checked: editMeta.isGoal,
                onToggle: (checked) =>
                  setEditMeta((prev) => ({ ...prev, isGoal: checked })),
              }}
            />
          </MetaDialogField>
        </div>
        {cycleWarning && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              曼陀羅全体に循環する経路が生じます。別シリーズの前/次コースの設定を見直してください。
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={() => {
              const crossSeriesPrev = filterCrossSeriesIds(
                series,
                course.id,
                editMeta.crossSeriesPrev,
              );
              const crossSeriesNext = filterCrossSeriesIds(
                series,
                course.id,
                editMeta.crossSeriesNext,
              );
              if (
                wouldCourseMetaEditCreateCycle(
                  series,
                  course.id,
                  crossSeriesPrev,
                  crossSeriesNext,
                )
              ) {
                setCycleWarning(true);
                return;
              }
              onSave(course.id, {
                name: editMeta.name.trim() || course.name,
                target: editMeta.target || undefined,
                style: editMeta.style || undefined,
                cross_series_prev: crossSeriesPrev,
                cross_series_next: crossSeriesNext,
                is_start: editMeta.isStart,
                is_goal: editMeta.isGoal,
              });
              onOpenChange(false);
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
