import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir } from "@/lib/contents-loader";
import { sanitizeFilename, stripPrefix } from "@/lib/content-filename";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    name: z.string().min(1),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    name: z.string().min(1),
  }),
  z.object({
    type: z.literal("lesson"),
    series: z.string().min(1),
    course: z.string().min(1),
    name: z.string().min(1),
  }),
]);

function renumberItems(dir: string, ext: "" | ".md") {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => ext === "" ? e.isDirectory() : e.name.endsWith(".md"))
    .map((e) => e.name)
    .sort((a, b) => {
      const na = parseInt(a.match(/^(\d+)/)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? "0", 10);
      return na - nb;
    });

  entries.forEach((oldName, i) => {
    const displayName = ext === "" ? stripPrefix(oldName) : stripPrefix(oldName);
    const newName = `${String(i + 1).padStart(2, "0")}_${displayName}${ext}`;
    if (oldName !== newName) {
      fs.renameSync(path.join(dir, oldName), path.join(dir, newName));
    }
  });
}

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

  if (parsed.data.type === "series") {
    const seriesDir = path.join(contentsDir, sanitizeFilename(parsed.data.name));
    if (!fs.existsSync(seriesDir)) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    fs.rmSync(seriesDir, { recursive: true, force: true });

    const orderFile = path.join(contentsDir, "_series-order.json");
    if (fs.existsSync(orderFile)) {
      const order = JSON.parse(fs.readFileSync(orderFile, "utf-8")) as string[];
      fs.writeFileSync(
        orderFile,
        JSON.stringify(order.filter((n) => n !== parsed.data.name), null, 2),
        "utf-8",
      );
    }
    return Response.json({ ok: true });
  }

  if (parsed.data.type === "course") {
    const seriesDir = path.join(contentsDir, sanitizeFilename(parsed.data.series));
    const courseDirs = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && stripPrefix(e.name) === parsed.data.name);
    if (courseDirs.length === 0) {
      return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
    }
    fs.rmSync(path.join(seriesDir, courseDirs[0].name), { recursive: true, force: true });
    renumberItems(seriesDir, "");
    return Response.json({ ok: true });
  }

  // lesson
  const lessonData = parsed.data as { type: "lesson"; series: string; course: string; name: string };
  const seriesDir = path.join(contentsDir, sanitizeFilename(lessonData.series));
  const courseDirs = fs
    .readdirSync(seriesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && stripPrefix(e.name) === lessonData.course);
  if (courseDirs.length === 0) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  const courseDir = path.join(seriesDir, courseDirs[0].name);
  const lessonFiles = fs
    .readdirSync(courseDir)
    .filter((f) => f.endsWith(".md") && stripPrefix(f) === lessonData.name);
  if (lessonFiles.length === 0) {
    return Response.json({ error: "レッスンファイルが見つかりません" }, { status: 404 });
  }
  fs.unlinkSync(path.join(courseDir, lessonFiles[0]));
  renumberItems(courseDir, ".md");
  return Response.json({ ok: true });
}
