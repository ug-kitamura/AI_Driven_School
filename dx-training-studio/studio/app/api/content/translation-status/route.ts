import { z } from "zod";
import { getProjectRoot } from "@/lib/project-root";
import {
  bodyFreshness,
  changelogFreshness,
  metaFreshness,
  type TranslationFreshness,
} from "@/lib/translation/freshness";
import {
  readChangelogPair,
  readLessonBodies,
  resolveUnit,
  unitHasEnValues,
  unitMetaSourceFields,
  unitStoredEnSourceHash,
  type UnitLevel,
} from "@/lib/translation/units";

const querySchema = z.object({
  series: z.string().min(1).optional(),
  course: z.string().min(1).optional(),
  lesson: z.string().min(1).optional(),
});

type UnitStatus = {
  meta: TranslationFreshness;
  /** レッスンのみ（本文の鮮度） */
  body?: TranslationFreshness;
};

/**
 * 選択に関わる各階層＋changelog の翻訳鮮度（studio-translation spec）。
 *
 * ロード API とは分離した読み取り専用エンドポイント——正本への書き込み
 * 副作用を持たない（ローダーの id 書き戻しを翻訳チップのために走らせない）。
 * チップの再取得契機はクライアント側（選択変更・保存成功・翻訳適用・最新化）。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    series: url.searchParams.get("series") ?? undefined,
    course: url.searchParams.get("course") ?? undefined,
    lesson: url.searchParams.get("lesson") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "クエリが不正です" }, { status: 400 });
  }

  const projectRoot = getProjectRoot();
  const { series, course, lesson } = parsed.data;

  const statuses: Partial<Record<UnitLevel, UnitStatus>> = {};
  const levels: Array<{ level: UnitLevel; enabled: boolean }> = [
    { level: "root", enabled: true },
    { level: "series", enabled: Boolean(series) },
    { level: "course", enabled: Boolean(series && course) },
    { level: "lesson", enabled: Boolean(series && course && lesson) },
  ];

  for (const { level, enabled } of levels) {
    if (!enabled) continue;
    const unit = resolveUnit(projectRoot, level, { series, course, lesson });
    if (!unit) continue;
    const status: UnitStatus = {
      meta: metaFreshness(
        unitMetaSourceFields(unit),
        unitHasEnValues(unit),
        unitStoredEnSourceHash(unit),
      ),
    };
    if (level === "lesson") {
      const { jaBody, enRaw } = readLessonBodies(unit.dir);
      status.body = bodyFreshness(jaBody, enRaw);
    }
    statuses[level] = status;
  }

  const changelogPair = readChangelogPair(projectRoot);
  const changelog =
    changelogPair === null
      ? null
      : changelogFreshness(changelogPair.jaContent, changelogPair.enContent);

  return Response.json({ statuses, changelog });
}
