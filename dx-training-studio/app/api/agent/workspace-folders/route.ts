import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { getProjectRoot } from "@/lib/project-root";
import { getWorkspaceDir } from "@/lib/workspace-paths";
import { validateFolderSegment } from "@/lib/workspace-path-utils";
import { resolveProjectIno } from "@/lib/workspace-meta";

/**
 * 案件フォルダ（workspace/ 直下）の一覧と作成。
 * ペイン4 のフォルダ選択 UI 用の最小 API（ツリー CRUD は持たない）。
 * ino はセッション永続化の localStorage フォールバックキーとして使う。
 */
export async function GET() {
  const projectRoot = getProjectRoot();
  const workspaceDir = getWorkspaceDir(projectRoot);
  if (!fs.existsSync(workspaceDir)) {
    return Response.json({ folders: [] });
  }
  const folders = fs
    .readdirSync(workspaceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => {
      const stat = fs.statSync(path.join(workspaceDir, entry.name));
      const resolved = resolveProjectIno(projectRoot, entry.name);
      return {
        id: entry.name,
        mtimeMs: stat.mtimeMs,
        ino: "ino" in resolved ? resolved.ino : undefined,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((entry) => ({ id: entry.id, ino: entry.ino }));
  return Response.json({ folders });
}

const bodySchema = z.object({
  name: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  const validation = validateFolderSegment(name);
  if (validation) {
    return Response.json({ error: validation }, { status: 400 });
  }
  if (name.startsWith(".")) {
    return Response.json({ error: "不正なフォルダ名です" }, { status: 400 });
  }

  const workspaceDir = getWorkspaceDir(getProjectRoot());
  const target = path.join(workspaceDir, name);
  if (fs.existsSync(target)) {
    return Response.json(
      { error: `同名のフォルダが既にあります: ${name}` },
      { status: 409 },
    );
  }
  fs.mkdirSync(target, { recursive: true });
  return Response.json({ ok: true, id: name });
}
