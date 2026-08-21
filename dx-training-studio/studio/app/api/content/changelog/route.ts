import fs from "node:fs";
import { z } from "zod";
import { firstEntryDate } from "@/lib/changelog-entry";
import {
  getChangelogPath,
  readChangelogFile,
} from "@/lib/changelog-draft";
import { getProjectRoot } from "@/lib/project-root";

/** 変更履歴の正本（contents/changelog.md）の閲覧・保存 */
export async function GET() {
  const file = readChangelogFile(getProjectRoot());
  return Response.json({
    exists: file.exists,
    content: file.content,
    mtimeMs: file.mtimeMs,
    firstEntryDate: firstEntryDate(file.content),
  });
}

const putSchema = z.object({
  /** そのまま書き込む。検証・整形・並べ替えはしない（書式は人の作法） */
  content: z.string(),
  /** GET で得た mtime。外部変更の検知（楽観ロック程度）。新規作成は null */
  baseMtimeMs: z.number().nullable(),
});

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "リクエスト body が不正です" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "リクエストが不正です" },
      { status: 400 },
    );
  }

  const projectRoot = getProjectRoot();
  const current = readChangelogFile(projectRoot);

  // 読み込み時点と mtime が食い違えば、外部（エディタ・Claude Code 等）での
  // 変更を上書きしないよう止める。厳密な排他はしない（同一ローカルの道具同士のため）
  const base = parsed.data.baseMtimeMs;
  const conflicted =
    current.mtimeMs === null
      ? base !== null
      : base === null || Math.abs(current.mtimeMs - base) > 1;
  if (conflicted) {
    return Response.json(
      {
        error:
          "changelog が外部で変更されています。内容を確認してから保存し直してください",
        content: current.content,
        mtimeMs: current.mtimeMs,
      },
      { status: 409 },
    );
  }

  const filePath = getChangelogPath(projectRoot);
  fs.writeFileSync(filePath, parsed.data.content, "utf-8");
  return Response.json({ ok: true, mtimeMs: fs.statSync(filePath).mtimeMs });
}
