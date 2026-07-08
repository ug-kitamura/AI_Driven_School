import fs from "node:fs";
import path from "node:path";
import {
  resolveFolderPath,
  SESSION_FILENAME,
} from "@/lib/workspace-paths";
import type { AgentChatStorage } from "@/lib/agent-chat-storage";
import { parseAgentChatStorage } from "@/lib/agent-chat-storage";

export function isAgentSessionFsWritable(): boolean {
  return process.env.AGENT_SESSION_FS !== "disabled";
}

export function resolveFolderSessionPath(
  projectRoot: string,
  folderId: string,
): string | null {
  const resolved = resolveFolderPath(projectRoot, folderId);
  if ("error" in resolved) return null;
  return path.join(resolved.absolutePath, SESSION_FILENAME);
}

export function readFolderSessionFile(
  projectRoot: string,
  folderId: string,
): AgentChatStorage | null {
  const sessionPath = resolveFolderSessionPath(projectRoot, folderId);
  if (!sessionPath || !fs.existsSync(sessionPath)) return null;
  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    return parseAgentChatStorage(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeFolderSessionFile(
  projectRoot: string,
  folderId: string,
  storage: AgentChatStorage,
): void {
  if (!isAgentSessionFsWritable()) {
    throw new Error("AGENT_SESSION_FS_DISABLED");
  }
  const sessionPath = resolveFolderSessionPath(projectRoot, folderId);
  if (!sessionPath) {
    throw new Error(`Folder not found: ${folderId}`);
  }
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(storage, null, 2), "utf-8");
}
