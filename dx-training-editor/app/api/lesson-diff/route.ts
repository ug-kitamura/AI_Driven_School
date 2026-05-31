import { z } from "zod";
import { createLessonContentDiff } from "@/lib/lesson-content-diff";
import { resolveHeadContent } from "@/lib/lesson-head-content";

const requestSchema = z.object({
  lessonId: z.string().min(1),
  content: z.string(),
  series: z.string().min(1),
  course: z.string().min(1),
  lesson: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const { lessonId, content, series, course, lesson } = parsed.data;
  const headResult = resolveHeadContent(
    process.cwd(),
    lessonId,
    series,
    course,
    lesson,
  );

  if ("error" in headResult) {
    return Response.json(
      {
        error: headResult.error,
        diff: "",
        headSource: "empty" as const,
        path: "",
      },
      { status: 503 },
    );
  }

  const diff = createLessonContentDiff(
    headResult.path,
    headResult.content,
    content,
  );

  return Response.json({
    diff,
    headSource: headResult.headSource,
    path: headResult.path,
  });
}
