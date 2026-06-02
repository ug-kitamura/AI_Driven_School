import { z } from "zod";
import { listLessonImageSlots } from "@/lib/lesson-image-slots";
import type { Lesson } from "@/lib/schema";

const bodySchema = z.object({
  lesson: z.custom<Lesson>(),
});

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const { lesson } = bodySchema.parse(json);
    const slots = await listLessonImageSlots(process.cwd(), lesson);
    return Response.json({ slots });
  } catch {
    return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  }
}
