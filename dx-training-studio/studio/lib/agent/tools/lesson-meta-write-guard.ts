import fs from "node:fs";
import { lessonMetaFileSchema } from "@/lib/schema";

export type LessonMetaWriteResult =
  | { ok: true; content: string }
  | { ok: false; error: string };

/**
 * レッスン `.meta.json` への agent 書込の検査。
 *
 * 門を開ける代わりに、保護の本来の目的（id と表示順を壊さない）を検査として残す:
 * 1. JSON としてパースできること
 * 2. レッスンメタスキーマに適合すること（未知キー拒否。`order` もここで弾かれる）
 * 3. `id` は agent の値を無視し、既存 `.meta.json` の `id` を保持する
 *    （既存が無ければ `id` キーを書かない——採番はローダーの責務）
 *
 * 検査を通った内容は整形（2スペースインデント）して返す。
 */
export function prepareLessonMetaWrite(
  absolutePath: string,
  relativePath: string,
  newContent: string,
): LessonMetaWriteResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(newContent);
  } catch (cause) {
    return {
      ok: false,
      error: [
        `.meta.json は JSON として妥当な内容で書いてください: ${relativePath}`,
        `原因: ${cause instanceof Error ? cause.message : String(cause)}`,
      ].join("\n"),
    };
  }

  const validated = lessonMetaFileSchema.safeParse(parsed);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    return {
      ok: false,
      error: [
        `レッスン .meta.json のスキーマに適合しません: ${relativePath}`,
        `${issue?.path.join(".") || "(root)"}: ${issue?.message ?? "不正な内容"}`,
        "書けるキー: slug / status / description / tags / estimated_minutes / author / author_en / name_en / description_en",
      ].join("\n"),
    };
  }

  // id は既存値を保護する（進捗データのキー。agent の値は無視する）
  const data: Record<string, unknown> = { ...validated.data };
  delete data.id;
  const existingId = readExistingId(absolutePath);
  const result = existingId ? { id: existingId, ...data } : data;

  return { ok: true, content: JSON.stringify(result, null, 2) };
}

function readExistingId(absolutePath: string): string | undefined {
  if (!fs.existsSync(absolutePath)) return undefined;
  try {
    const raw = JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as Record<
      string,
      unknown
    >;
    return typeof raw.id === "string" && raw.id ? raw.id : undefined;
  } catch {
    // 既存が壊れている場合は id を復元できない。上書きで修復される
    return undefined;
  }
}
