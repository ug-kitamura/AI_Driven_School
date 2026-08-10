import { z } from "zod";
import {
  isAgentSessionFsWritable,
  readFolderSessionFile,
  writeFolderSessionFile,
} from "@/lib/agent-session-store";
import { parseAgentChatStorage } from "@/lib/agent-chat-storage";
import { getProjectRoot } from "@/lib/project-root";

const storageSchema = z.object({
  version: z.literal(1),
  activeSessionId: z.string().min(1),
  sessions: z.array(z.unknown()),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId")?.trim();
  if (!folderId) {
    return Response.json({ error: "folderId が必要です" }, { status: 400 });
  }

  if (!isAgentSessionFsWritable()) {
    return Response.json(
      { error: "ファイルシステムへの session 保存は利用できません" },
      { status: 501 },
    );
  }

  const storage = readFolderSessionFile(getProjectRoot(), folderId);
  if (!storage) {
    return Response.json(
      { error: "session が見つかりません" },
      { status: 404 },
    );
  }

  return Response.json(storage);
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId")?.trim();
  if (!folderId) {
    return Response.json({ error: "folderId が必要です" }, { status: 400 });
  }

  if (!isAgentSessionFsWritable()) {
    return Response.json(
      { error: "ファイルシステムへの session 保存は利用できません" },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = storageSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const storage = parseAgentChatStorage(parsed.data);
  if (!storage) {
    return Response.json({ error: "Invalid session storage" }, { status: 400 });
  }

  try {
    writeFolderSessionFile(getProjectRoot(), folderId, storage);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Folder not found")) {
      return Response.json({ error: message }, { status: 404 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
