import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { resolveOrCreateLessonFilePath } from "@/lib/contents-loader";
import {
  lessonFileTextEquals,
  normalizeLessonFileNewlines,
} from "@/lib/lesson-file-text";

const schema = z.object({
  series: z.string().min(1),
  course: z.string().min(1),
  lesson: z.string().min(1),
  content: z.string(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const { series, course, lesson, content } = parsed.data;
  const filePath = resolveOrCreateLessonFilePath(
    process.cwd(),
    series,
    course,
    lesson,
  );

  if (!filePath) {
    return Response.json(
      { error: `レッスンファイルを作成できません: ${series}/${course}/${lesson}` },
      { status: 404 },
    );
  }

  const normalizedContent = normalizeLessonFileNewlines(content);

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, "utf-8");
      if (lessonFileTextEquals(existing, normalizedContent)) {
        if (existing !== normalizedContent) {
          fs.writeFileSync(filePath, normalizedContent, "utf-8");
        }
        return Response.json({ ok: true, skipped: true });
      }
    }
    fs.writeFileSync(filePath, normalizedContent, "utf-8");
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
