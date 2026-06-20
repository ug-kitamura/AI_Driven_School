import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import {
  getContentsDir,
  findSeriesDir,
  findCourseDir,
} from "@/lib/contents-loader";
import { isValidSlug } from "@/lib/content-filename";

const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("series"),
    oldSlug: z.string().min(1),
    newSlug: z.string().min(1),
    /** 警告を確認したことを示すフラグ */
    confirmed: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("course"),
    series: z.string().min(1),
    oldSlug: z.string().min(1),
    newSlug: z.string().min(1),
    confirmed: z.boolean().default(false),
  }),
]);

function readOrderJson(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as string[];
  } catch {
    return [];
  }
}

function updateOrderJson(filePath: string, oldSlug: string, newSlug: string): void {
  const order = readOrderJson(filePath).map((s) => (s === oldSlug ? newSlug : s));
  fs.writeFileSync(filePath, JSON.stringify(order, null, 2), "utf-8");
}

/** _mandala.json 内のスラッグ参照を一括更新する */
function updateMandalaRefs(contentsDir: string, oldSlug: string, newSlug: string): void {
  try {
    const seriesDirs = fs
      .readdirSync(contentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
      .map((e) => path.join(contentsDir, e.name));

    for (const seriesDir of seriesDirs) {
      const courseDirs = fs
        .readdirSync(seriesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
        .map((e) => path.join(seriesDir, e.name));

      for (const courseDir of courseDirs) {
        const mandalaPath = path.join(courseDir, "_mandala.json");
        if (!fs.existsSync(mandalaPath)) continue;
        const data = JSON.parse(fs.readFileSync(mandalaPath, "utf-8")) as {
          prerequisites?: string[];
          next_courses?: string[];
        };
        const prereqs = (data.prerequisites ?? []).map((s: string) => (s === oldSlug ? newSlug : s));
        const nexts = (data.next_courses ?? []).map((s: string) => (s === oldSlug ? newSlug : s));
        fs.writeFileSync(
          mandalaPath,
          JSON.stringify({ prerequisites: prereqs, next_courses: nexts }, null, 2),
          "utf-8",
        );
      }
    }
  } catch { /* ignore */ }
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

  if (!parsed.data.confirmed) {
    return Response.json(
      {
        requiresConfirmation: true,
        warning:
          "スラッグを変更すると、外部リンクや他のファイルの参照が壊れる可能性があります。続行しますか？",
      },
      { status: 200 },
    );
  }

  const contentsDir = getContentsDir(process.cwd());

  if (parsed.data.type === "series") {
    const { oldSlug, newSlug } = parsed.data;
    if (!isValidSlug(newSlug)) {
      return Response.json({ error: `スラッグ '${newSlug}' が不正です` }, { status: 400 });
    }
    const oldDir = path.join(contentsDir, oldSlug);
    const newDir = path.join(contentsDir, newSlug);
    if (!fs.existsSync(oldDir)) {
      return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
    }
    if (fs.existsSync(newDir)) {
      return Response.json({ error: `スラッグ '${newSlug}' はすでに使われています` }, { status: 409 });
    }
    fs.renameSync(oldDir, newDir);
    updateOrderJson(path.join(contentsDir, "_series-order.json"), oldSlug, newSlug);
    return Response.json({ ok: true });
  }

  // course
  const { series: seriesSlug, oldSlug, newSlug } = parsed.data as {
    type: "course"; series: string; oldSlug: string; newSlug: string; confirmed: boolean;
  };
  if (!isValidSlug(newSlug)) {
    return Response.json({ error: `スラッグ '${newSlug}' が不正です` }, { status: 400 });
  }
  const seriesDir = findSeriesDir(contentsDir, seriesSlug);
  if (!seriesDir) {
    return Response.json({ error: "シリーズフォルダが見つかりません" }, { status: 404 });
  }
  const oldDir = path.join(seriesDir, oldSlug);
  const newDir = path.join(seriesDir, newSlug);
  if (!fs.existsSync(oldDir)) {
    return Response.json({ error: "コースフォルダが見つかりません" }, { status: 404 });
  }
  if (fs.existsSync(newDir)) {
    return Response.json({ error: `スラッグ '${newSlug}' はすでに使われています` }, { status: 409 });
  }
  fs.renameSync(oldDir, newDir);
  updateOrderJson(path.join(seriesDir, "_course-order.json"), oldSlug, newSlug);
  // _mandala.json の参照を一括更新
  updateMandalaRefs(contentsDir, oldSlug, newSlug);
  return Response.json({ ok: true });
}
