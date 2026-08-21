import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { writeMetaJson } from "@/lib/contents-loader";
import { getProjectRoot } from "@/lib/project-root";
import {
  computeBodySourceHash,
  computeMetaSourceHash,
  formatSourceHashComment,
  parseEnBody,
} from "@/lib/translation/freshness";
import {
  readLessonBodies,
  resolveUnit,
  unitHasEnValues,
  unitMetaSourceFields,
} from "@/lib/translation/units";

const bodySchema = z.object({
  level: z.enum(["root", "series", "course", "lesson"]),
  /** レッスンのみ: "body"（本文ハッシュ行）か "meta"（en_source_hash）。他階層は meta 固定 */
  target: z.enum(["body", "meta"]).optional(),
  series: z.string().min(1).optional(),
  course: z.string().min(1).optional(),
  lesson: z.string().min(1).optional(),
});

/**
 * 「最新として扱う」（studio-translation spec）。
 *
 * 翻訳はせず、ハッシュだけを現在の日本語側から再計算して書く——
 * 原文更新後に人が英語側を手直しした（or 差分が翻訳に影響しない）と
 * 判断したときの明示的な解消手段。英語側が存在しないユニットでは実行できない。
 * changelog には提供しない（日付比較は追訳でしか解消しない）。
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const { level, target, series, course, lesson } = parsed.data;
  const projectRoot = getProjectRoot();
  const unit = resolveUnit(projectRoot, level, { series, course, lesson });
  if (!unit) {
    return Response.json({ error: "対象が見つかりません" }, { status: 404 });
  }

  if (level === "lesson" && target === "body") {
    const { jaBody, enRaw } = readLessonBodies(unit.dir);
    if (enRaw === null) {
      return Response.json(
        { error: "英語版本文（contents.en.md）が無いため最新化できません" },
        { status: 409 },
      );
    }
    const { body: enBody } = parseEnBody(enRaw);
    const hashLine = formatSourceHashComment(computeBodySourceHash(jaBody));
    fs.writeFileSync(
      path.join(unit.dir, "contents.en.md"),
      `${hashLine}\n\n${enBody.replace(/^\n+/, "")}`,
      "utf-8",
    );
    return Response.json({ ok: true });
  }

  // メタ: _en が全て空（未翻訳）のユニットは最新化できない
  if (!unitHasEnValues(unit)) {
    return Response.json(
      { error: "英訳フィールドが空のため最新化できません（未翻訳）" },
      { status: 409 },
    );
  }
  writeMetaJson(unit.dir, {
    ...unit.meta,
    en_source_hash: computeMetaSourceHash(unitMetaSourceFields(unit)),
  });
  return Response.json({ ok: true });
}
