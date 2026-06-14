import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getContentsDir } from "@/lib/contents-loader";
import { sanitizeFilename, stripPrefix } from "@/lib/content-filename";

const schema = z.object({
  order: z.array(z.string()),
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

  const contentsDir = getContentsDir(process.cwd());
  const existingDirs = fs
    .readdirSync(contentsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const oldByName = new Map(existingDirs.map((d) => [stripPrefix(d), d]));
  const renames: Array<{ from: string; tmp: string; to: string }> = [];

  for (let i = 0; i < parsed.data.order.length; i++) {
    const seriesName = parsed.data.order[i];
    const oldDirName = oldByName.get(seriesName);
    if (!oldDirName) continue;
    const newDirName = `${String(i + 1).padStart(2, "0")}_${sanitizeFilename(seriesName)}`;
    if (oldDirName !== newDirName) {
      renames.push({
        from: path.join(contentsDir, oldDirName),
        tmp: path.join(contentsDir, `__tmp_${i}_${oldDirName}`),
        to: path.join(contentsDir, newDirName),
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
    return Response.json({ error: `シリーズ並び替えエラー: ${String(err)}` }, { status: 500 });
  }

  return Response.json({ ok: true });
}
