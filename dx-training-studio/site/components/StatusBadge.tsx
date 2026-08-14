import type { LessonStatus } from "@/lib/site-data";
import type { Locale } from "@/lib/locale-path";

const LABELS: Record<
  Exclude<LessonStatus, "done">,
  { ja: string; en: string }
> = {
  in_progress: { ja: "執筆中", en: "Draft" },
  open: { ja: "未着手", en: "Planned" },
};

/** 完成（done）にはバッジを出さない */
export function StatusBadge({
  status,
  locale = "ja",
}: {
  status: LessonStatus;
  locale?: Locale;
}) {
  if (status === "done") return null;
  const label = LABELS[status][locale];
  return (
    <span className={`dxm-badge dxm-badge-${status}`} title={label}>
      {label}
    </span>
  );
}

export function UntranslatedBadge({ locale }: { locale: Locale }) {
  if (locale !== "en") return null;
  return (
    <span className="dxm-badge dxm-badge-untranslated">
      Not translated yet — showing Japanese
    </span>
  );
}
