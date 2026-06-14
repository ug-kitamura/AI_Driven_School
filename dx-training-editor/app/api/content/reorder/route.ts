import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir, findSeriesDir, findCourseDir } from "@/lib/contents-loader";
import { sanitizeFilename, stripPrefix } from "@/lib/content-filename";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    /** 新しい順序のコース表示名リスト */
    newOrder: z.array(z.string()),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    /** 新しい順序のレッスン表示名リスト */
    newOrder: z.array(z.string()),
  }),
]);

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

  const contentsDir = getContentsDir(process.cwd());

  if (parsed.data.type === "course") {
    const seriesDir = findSeriesDir(contentsDir, parsed.data.series);
    if (!seriesDir) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    const oldDirs = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    const oldByName = new Map(oldDirs.map((d) => [stripPrefix(d), d]));
    const renames: Array<{ from: string; tmp: string; to: string }> = [];

    for (let i = 0; i < parsed.data.newOrder.length; i++) {
      const courseName = parsed.data.newOrder[i];
      const oldDirName = oldByName.get(courseName);
      if (!oldDirName) continue;
      const newDirName = `${String(i + 1).padStart(2, "0")}_${sanitizeFilename(courseName)}`;
      if (oldDirName !== newDirName) {
        renames.push({
          from: path.join(seriesDir, oldDirName),
          tmp: path.join(seriesDir, `__tmp_${i}_${oldDirName}`),
          to: path.join(seriesDir, newDirName),
        });
      }
    }

    const completed: string[] = [];
    try {
      for (const r of renames) {
        fs.renameSync(r.from, r.tmp);
        completed.push(r.tmp);
      }
      for (let i = 0; i < renames.length; i++) {
        fs.renameSync(renames[i].tmp, renames[i].to);
        completed[i] = renames[i].to;
      }
    } catch (err) {
      // ロールバック試行
      for (let i = completed.length - 1; i >= 0; i--) {
        try { fs.renameSync(completed[i], renames[i].from); } catch { /* ignore */ }
      }
      return Response.json({ error: `並び替えエラー: ${String(err)}` }, { status: 500 });
    }

    return Response.json({ ok: true });
  }

  // lesson
  const lessonData = parsed.data as {
    type: "lesson";
    series: string;
    course: string;
    newOrder: string[];
  };
  const lessonSeriesDir = findSeriesDir(contentsDir, lessonData.series);
  if (!lessonSeriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = findCourseDir(lessonSeriesDir, lessonData.course);
  if (!courseDir) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  const oldFiles = fs.readdirSync(courseDir).filter((f) => f.endsWith(".md"));
  const oldByName = new Map(oldFiles.map((f) => [stripPrefix(f), f]));
  const renames: Array<{ from: string; tmp: string; to: string }> = [];

  for (let i = 0; i < lessonData.newOrder.length; i++) {
    const lessonName = lessonData.newOrder[i];
    const oldFileName = oldByName.get(lessonName);
    if (!oldFileName) continue;
    const newFileName = `${String(i + 1).padStart(2, "0")}_${sanitizeFilename(lessonName)}.md`;
    if (oldFileName !== newFileName) {
      renames.push({
        from: path.join(courseDir, oldFileName),
        tmp: path.join(courseDir, `__tmp_${i}_${oldFileName}`),
        to: path.join(courseDir, newFileName),
      });
    }
  }

  const completed: string[] = [];
  try {
    for (const r of renames) {
      fs.renameSync(r.from, r.tmp);
      completed.push(r.tmp);
    }
    for (let i = 0; i < renames.length; i++) {
      fs.renameSync(renames[i].tmp, renames[i].to);
      completed[i] = renames[i].to;
    }
  } catch (err) {
    for (let i = completed.length - 1; i >= 0; i--) {
      try { fs.renameSync(completed[i], renames[i].from); } catch { /* ignore */ }
    }
    return Response.json({ error: `並び替えエラー: ${String(err)}` }, { status: 500 });
  }

  return Response.json({ ok: true });
}
