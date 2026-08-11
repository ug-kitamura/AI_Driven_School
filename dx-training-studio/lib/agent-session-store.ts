import fs from "node:fs";
import path from "node:path";
import { getContentsDir } from "@/lib/contents-loader";
import {
  parseSessionScope,
  sessionScopeLevel,
  sessionScopeRelativePath,
  type SessionScope,
} from "@/lib/session-scope";
import type { AgentChatStorage } from "@/lib/agent-chat-storage";
import { parseAgentChatStorage } from "@/lib/agent-chat-storage";

export function isAgentSessionFsWritable(): boolean {
  return process.env.AGENT_SESSION_FS !== "disabled";
}

/**
 * セッションの保存先は `contents/` 配下のフォーカス階層の `session.json`。
 * フォルダをリネームしてもファイルごと移動するため、安定 ID を持たないレッスンでも
 * 履歴が追従する。
 */
export function resolveScopeSessionPath(
  projectRoot: string,
  scope: SessionScope,
): string {
  const contentsDir = path.resolve(getContentsDir(projectRoot));
  const absolutePath = path.resolve(
    contentsDir,
    sessionScopeRelativePath(scope),
  );
  if (!absolutePath.startsWith(contentsDir + path.sep)) {
    throw new Error("不正なスコープです");
  }
  return absolutePath;
}

/** クエリ文字列からスコープを解決する。不正なら null。 */
export function resolveScopeFromParam(raw: string | null): SessionScope | null {
  return parseSessionScope(raw ?? "");
}

export function readScopeSessionFile(
  projectRoot: string,
  scope: SessionScope,
): AgentChatStorage | null {
  let sessionPath: string;
  try {
    sessionPath = resolveScopeSessionPath(projectRoot, scope);
  } catch {
    return null;
  }
  if (!fs.existsSync(sessionPath)) return null;
  try {
    const raw = fs.readFileSync(sessionPath, "utf-8");
    return parseAgentChatStorage(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeScopeSessionFile(
  projectRoot: string,
  scope: SessionScope,
  storage: AgentChatStorage,
): void {
  if (!isAgentSessionFsWritable()) {
    throw new Error("AGENT_SESSION_FS_DISABLED");
  }
  const sessionPath = resolveScopeSessionPath(projectRoot, scope);
  const dir = path.dirname(sessionPath);
  if (!fs.existsSync(dir)) {
    if (sessionScopeLevel(scope) === "root") {
      // シリーズ 0 件の初期状態では contents/ 自体が無いことがある。
      // ここはアプリのデータルートなので作ってよい。
      fs.mkdirSync(dir, { recursive: true });
    } else {
      // シリーズ/コース/レッスンが消えた状態。
      // session.json のためだけにコンテンツのディレクトリを作らない。
      throw new Error(`Scope not found: ${sessionPath}`);
    }
  }
  fs.writeFileSync(sessionPath, JSON.stringify(storage, null, 2), "utf-8");
}
