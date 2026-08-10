import fs from "node:fs";
import path from "node:path";
import {
  resolveFolderPath,
  SESSION_FILENAME,
  getProjectFolderId,
} from "@/lib/workspace-paths";
import {
  getMetaSessionPath,
  getMetaSessionsDir,
  resolveProjectIno,
} from "@/lib/workspace-meta";
import type { AgentChatStorage } from "@/lib/agent-chat-storage";
import { parseAgentChatStorage } from "@/lib/agent-chat-storage";

export function isAgentSessionFsWritable(): boolean {
  return process.env.AGENT_SESSION_FS !== "disabled";
}

/**
 * セッション保存先は `.meta/sessions/<ino>.json`。
 * folderId（プロジェクトフォルダ名）からの ino 解決はここで行い、
 * API・クライアントには folderPath ベースの契約を維持する。
 */
export function resolveFolderSessionPath(
  projectRoot: string,
  folderId: string,
): string | null {
  const resolved = resolveProjectIno(projectRoot, folderId);
  if ("error" in resolved) return null;
  return getMetaSessionPath(projectRoot, resolved.ino);
}

/** 移行前データ用のレガシーパス（フォルダ内 session.json）。読み取り専用。 */
function resolveLegacySessionPath(
  projectRoot: string,
  folderId: string,
): string | null {
  const resolved = resolveFolderPath(
    projectRoot,
    getProjectFolderId(folderId.trim()),
  );
  if ("error" in resolved) return null;
  return path.join(resolved.absolutePath, SESSION_FILENAME);
}

export function readFolderSessionFile(
  projectRoot: string,
  folderId: string,
): AgentChatStorage | null {
  const sessionPath = resolveFolderSessionPath(projectRoot, folderId);
  if (sessionPath && fs.existsSync(sessionPath)) {
    const storage = readStorageFile(sessionPath);
    if (storage) return storage;
  }
  // マイグレーション未実行のワークスペースに対する防御的フォールバック
  const legacyPath = resolveLegacySessionPath(projectRoot, folderId);
  if (legacyPath && fs.existsSync(legacyPath)) {
    return readStorageFile(legacyPath);
  }
  return null;
}

function readStorageFile(filePath: string): AgentChatStorage | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
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
  fs.mkdirSync(getMetaSessionsDir(projectRoot), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(storage, null, 2), "utf-8");
}
